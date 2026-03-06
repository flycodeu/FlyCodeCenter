interface ExtendedBuildOptions {
  enableChartJs?: boolean;
  enableDemoBlock?: boolean;
  enableTabs?: boolean;
  enableCodeGroup?: boolean;
  enableSteps?: boolean;
  enableMark?: boolean;
  enableIcon?: boolean;
  enableCalloutTemplates?: boolean;
  chartHeight?: number;
}

const START_CHART = /^:::\s*chartjs(?:\s+(.+))?\s*$/i;
const START_CHART_LOOSE = /^:::\s*chartjs\b/i;
const START_TABS = /^:::\s*tabs\s*$/i;
const START_TABS_LOOSE = /^:::\s*tabs\b/i;
const START_CODE_GROUP = /^:::\s*code-group\s*$/i;
const START_CODE_GROUP_LOOSE = /^:::\s*code-group\b/i;
const END_TRIPLE = /^:::\s*$/i;
const START_STEPS = /^::::\s*steps\s*$/i;
const START_STEPS_LOOSE = /^::::\s*steps\b/i;
const END_QUAD = /^::::\s*$/i;
const TAB_LABEL = /^@tab\s+(.+)$/i;
const CODE_GROUP_LABEL = /^@code\s+(.+)$/i;
const INLINE_TOKEN = /==([^=\n][\s\S]*?)==\{\.(tip|warning|danger|important)\}|:\[([^\]]+)\]:/g;
const SHORTCODE_PATTERN = /^\[(video|checkbox|hidden|admonition|callout|demo)\b([^\]]*)\]([\s\S]*?)\[\/\1\]$/i;
const SHORTCODE_DEMO_OPEN = /^\[demo\b([^\]]*)\]\s*$/i;
const SHORTCODE_DEMO_CLOSE = /^\[\/demo\]\s*$/i;
const SHORTCODE_ATTR = /([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=]+))/gi;
const ADMONITION_COLORS = new Set(["indigo", "green", "red", "blue", "orange", "black", "grey"]);
const HIDDEN_TYPES = new Set(["background", "blur"]);
const DEMO_MODES = new Set(["split", "stack"]);
const DEMO_RESULTS = new Set(["auto", "force"]);

type MdNode = {
  type?: string;
  children?: unknown[];
  value?: string;
  lang?: string;
  meta?: string;
  url?: string;
  position?: {
    start?: { offset?: number; line?: number; column?: number };
    end?: { offset?: number; line?: number; column?: number };
  };
  data?: Record<string, unknown>;
};

type ShortcodeName = "video" | "checkbox" | "hidden" | "admonition" | "callout" | "demo";

type ShortcodeParseResult = {
  name: ShortcodeName;
  attrs: Record<string, string>;
  body: string;
};

function isNode(value: unknown): value is MdNode {
  return Boolean(value && typeof value === "object");
}

function normalizeLine(input: string): string {
  return String(input || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .trim();
}

type InlineExtractOptions = {
  preferLinkUrl?: boolean;
};

type SourceLocator = {
  text: string;
  lineStarts: number[];
};

type SourceLine = {
  start: number;
  end: number;
  breakEnd: number;
  text: string;
};

type DemoRegion = {
  startOffset: number;
  endOffset: number;
  attrsRaw: string;
  body: string;
  consumed?: boolean;
};

type NodeOffsets = {
  start: number;
  end: number;
};

function decodeUrlSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractInlineText(node: unknown, options: InlineExtractOptions = {}): string {
  if (!isNode(node)) return "";
  if (node.type === "break") return "\n";
  if (typeof node.value === "string" && (node.type === "text" || node.type === "inlineCode")) {
    return node.value;
  }
  if (node.type === "link" && Array.isArray(node.children)) {
    const linked = node.children.map((item) => extractInlineText(item, options)).join("");
    const linkUrl = typeof node.url === "string" ? decodeUrlSafely(node.url) : "";
    if (options.preferLinkUrl && linkUrl) return linkUrl;
    if (linked) return linked;
    if (linkUrl) return linkUrl;
  }
  if (Array.isArray(node.children)) {
    return node.children.map((item) => extractInlineText(item, options)).join("");
  }
  return "";
}

function getParagraphText(node: unknown, options: InlineExtractOptions = {}): string {
  if (!isNode(node) || node.type !== "paragraph" || !Array.isArray(node.children)) return "";
  return node.children.map((child) => extractInlineText(child, options)).join("");
}

function createSourceLocator(sourceText: string): SourceLocator | null {
  if (!sourceText) return null;
  const lineStarts = [0];
  for (let i = 0; i < sourceText.length; i += 1) {
    const char = sourceText.charCodeAt(i);
    if (char === 13) {
      if (sourceText.charCodeAt(i + 1) === 10) {
        i += 1;
      }
      lineStarts.push(i + 1);
      continue;
    }
    if (char === 10) {
      lineStarts.push(i + 1);
    }
  }
  return { text: sourceText, lineStarts };
}

function collectSourceLines(sourceText: string): SourceLine[] {
  const lines: SourceLine[] = [];
  if (!sourceText) return lines;
  let lineStart = 0;

  for (let i = 0; i < sourceText.length; i += 1) {
    const char = sourceText.charCodeAt(i);
    if (char !== 13 && char !== 10) continue;

    const lineEnd = i;
    if (char === 13 && sourceText.charCodeAt(i + 1) === 10) {
      i += 1;
    }
    const breakEnd = i + 1;
    lines.push({
      start: lineStart,
      end: lineEnd,
      breakEnd,
      text: sourceText.slice(lineStart, lineEnd)
    });
    lineStart = breakEnd;
  }

  lines.push({
    start: lineStart,
    end: sourceText.length,
    breakEnd: sourceText.length,
    text: sourceText.slice(lineStart)
  });

  return lines;
}

function parseFenceMarker(line: string): { char: "`" | "~"; length: number } | null {
  const match = String(line || "").trim().match(/^(`{3,}|~{3,})/);
  if (!match) return null;
  const token = String(match[1] || "");
  const char = token.slice(0, 1);
  if (char !== "`" && char !== "~") return null;
  return { char: char as "`" | "~", length: token.length };
}

function collectDemoRegionsFromSource(sourceText: string): DemoRegion[] {
  if (!sourceText) return [];
  const lines = collectSourceLines(sourceText);
  const regions: DemoRegion[] = [];
  let outerFence: { char: "`" | "~"; length: number } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = String(line.text || "").trim();
    const fence = parseFenceMarker(trimmed);

    if (outerFence) {
      if (fence && fence.char === outerFence.char && fence.length >= outerFence.length) {
        outerFence = null;
      }
      continue;
    }
    if (fence) {
      outerFence = fence;
      continue;
    }

    const open = trimmed.match(SHORTCODE_DEMO_OPEN);
    if (!open) continue;

    let closeIndex = -1;
    let innerFence: { char: "`" | "~"; length: number } | null = null;
    for (let cursor = i + 1; cursor < lines.length; cursor += 1) {
      const current = lines[cursor];
      if (!current) continue;
      const currentTrimmed = String(current.text || "").trim();
      const currentFence = parseFenceMarker(currentTrimmed);
      if (innerFence) {
        if (currentFence && currentFence.char === innerFence.char && currentFence.length >= innerFence.length) {
          innerFence = null;
        }
        continue;
      }
      if (currentFence) {
        innerFence = currentFence;
        continue;
      }
      if (SHORTCODE_DEMO_CLOSE.test(currentTrimmed)) {
        closeIndex = cursor;
        break;
      }
    }

    if (closeIndex < 0) break;
    const closeLine = lines[closeIndex];
    if (!closeLine) break;
    const body = sourceText.slice(line.breakEnd, closeLine.start);
    regions.push({
      startOffset: line.start,
      endOffset: closeLine.breakEnd,
      attrsRaw: String(open[1] || ""),
      body
    });
    i = closeIndex;
  }

  return regions;
}

function resolvePointOffset(
  point: { offset?: number; line?: number; column?: number } | undefined,
  locator: SourceLocator
): number | null {
  if (!point) return null;
  if (Number.isInteger(point.offset)) {
    const offset = point.offset as number;
    if (offset >= 0 && offset <= locator.text.length) return offset;
    return null;
  }
  if (!Number.isInteger(point.line) || !Number.isInteger(point.column)) return null;
  const line = point.line as number;
  const column = point.column as number;
  if (line <= 0 || column <= 0) return null;
  const lineStart = locator.lineStarts[line - 1];
  if (!Number.isInteger(lineStart)) return null;
  const offset = lineStart + (column - 1);
  if (offset < 0 || offset > locator.text.length) return null;
  return offset;
}

function resolveNodeOffsets(node: unknown, locator: SourceLocator | null): NodeOffsets | null {
  if (!locator || !locator.text) return null;
  if (!isNode(node)) return null;
  const start = resolvePointOffset(node.position?.start, locator);
  const end = resolvePointOffset(node.position?.end, locator);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end <= start || end > locator.text.length) return null;
  return { start, end };
}

function getNodeSourceSlice(node: unknown, locator: SourceLocator | null): string {
  if (!locator || !locator.text) return "";
  if (!isNode(node)) return "";
  const start = resolvePointOffset(node.position?.start, locator);
  const end = resolvePointOffset(node.position?.end, locator);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return "";
  if (start < 0 || end <= start || end > locator.text.length) return "";
  return locator.text.slice(start, end);
}

function getParagraphCandidates(node: unknown, locator: SourceLocator | null): string[] {
  const optionsList: InlineExtractOptions[] = [{ preferLinkUrl: false }, { preferLinkUrl: true }];
  const unique = new Set<string>();
  const result: string[] = [];
  if (locator) {
    const sourceCandidate = normalizeSmartQuotes(getNodeSourceSlice(node, locator)).trim();
    if (sourceCandidate && !unique.has(sourceCandidate)) {
      unique.add(sourceCandidate);
      result.push(sourceCandidate);
    }
  }
  for (const options of optionsList) {
    const raw = getParagraphText(node, options);
    if (!raw) continue;
    const normalized = normalizeSmartQuotes(raw).trim();
    if (!normalized || unique.has(normalized)) continue;
    unique.add(normalized);
    result.push(normalized);
  }
  return result;
}

function getParagraphLines(node: unknown): string[] {
  const raw = getParagraphText(node);
  if (!raw) return [];
  return raw.split(/\r?\n/).map(normalizeLine);
}

function findLineIndex(lines: string[], tester: RegExp): number {
  for (let i = 0; i < lines.length; i += 1) {
    if (tester.test(lines[i] || "")) return i;
  }
  return -1;
}

function createParagraph(value: string) {
  return {
    type: "paragraph",
    children: [createText(value)]
  };
}

function sanitizeProps(input: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value) && value.length === 0) return;
    next[key] = value;
  });
  return next;
}

function createElement(tag: string, props: Record<string, unknown> = {}, children: unknown[] = []) {
  return {
    type: "extendedElement",
    data: {
      hName: tag,
      hProperties: sanitizeProps(props)
    },
    children
  };
}

function createText(value: string) {
  return { type: "text", value };
}

function normalizeSmartQuotes(input: string): string {
  return String(input || "")
    .replace(/[\u201c\u201d\u2033\uff02]/g, "\"")
    .replace(/[\u2018\u2019\u2032\uff07]/g, "'");
}

function parseShortcodeAttributes(rawAttrs: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const normalizedAttrs = normalizeSmartQuotes(rawAttrs);
  SHORTCODE_ATTR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SHORTCODE_ATTR.exec(normalizedAttrs)) !== null) {
    const key = String(match[1] || "").trim().toLowerCase();
    if (!key) continue;
    attrs[key] = String(match[2] ?? match[3] ?? match[4] ?? "").trim();
  }
  return attrs;
}

function extractVideoUrlFromRaw(rawInput: string): string {
  const normalized = normalizeSmartQuotes(String(rawInput || ""));
  const match = normalized.match(/https?:\/\/[^\s<>"'\]]+/i);
  if (!match) return "";
  return String(match[0] || "").trim();
}

function parseVideoShortcodeLoose(rawInput: string): ShortcodeParseResult | null {
  const raw = normalizeSmartQuotes(String(rawInput || "")).trim();
  if (!raw || !/^\[video\b/i.test(raw)) return null;
  const openMatch = raw.match(/^\[video\b([^\]]*)\]/i);
  if (!openMatch) return null;

  const attrs = parseShortcodeAttributes(String(openMatch[1] || ""));
  const rest = raw.slice(openMatch[0].length);
  const closeMatch = rest.match(/\[\/video\]/i) || rest.match(/\[\/video\b/i);
  const body = closeMatch ? rest.slice(0, closeMatch.index).trim() : "";

  if (!attrs.url) {
    const guessedUrl = extractVideoUrlFromRaw(raw);
    if (guessedUrl) attrs.url = guessedUrl;
  }
  return { name: "video", attrs, body };
}

function parseShortcode(rawInput: string): ShortcodeParseResult | null {
  const raw = normalizeSmartQuotes(String(rawInput || "")).trim();
  if (!raw) return null;
  const match = raw.match(SHORTCODE_PATTERN);
  if (!match) {
    return parseVideoShortcodeLoose(raw);
  }
  const name = String(match[1] || "").trim().toLowerCase() as ShortcodeName;
  if (!name) return null;
  const attrs = parseShortcodeAttributes(String(match[2] || ""));
  const body = String(match[3] || "");
  return { name, attrs, body };
}

function parseShortcodeSequence(rawInput: string): ShortcodeParseResult[] | null {
  const raw = normalizeSmartQuotes(String(rawInput || ""));
  if (!raw.trim()) return null;
  const results: ShortcodeParseResult[] = [];
  const pattern = /^\[(video|checkbox|hidden|admonition|callout|demo)\b([^\]]*)\]([\s\S]*?)\[\/\1\]/i;
  let cursor = 0;
  while (cursor < raw.length) {
    while (cursor < raw.length && /\s/.test(raw[cursor] || "")) cursor += 1;
    if (cursor >= raw.length) break;
    const slice = raw.slice(cursor);
    const match = slice.match(pattern);
    if (!match) return null;
    const full = match[0];
    const shortcode = parseShortcode(full);
    if (!shortcode) return null;
    results.push(shortcode);
    cursor += full.length;
  }
  return results.length ? results : null;
}

function applyDemoRegionsToChildren(
  children: unknown[],
  regions: DemoRegion[],
  sourceLocator: SourceLocator | null
) {
  if (!sourceLocator || !Array.isArray(children) || !children.length || !regions.length) return;

  for (const region of regions) {
    if (region.consumed) continue;

    let firstIndex = -1;
    let lastIndex = -1;
    let firstOffsets: NodeOffsets | null = null;
    let lastOffsets: NodeOffsets | null = null;

    for (let i = 0; i < children.length; i += 1) {
      const offsets = resolveNodeOffsets(children[i], sourceLocator);
      if (!offsets) continue;
      if (offsets.end <= region.startOffset) continue;
      if (offsets.start >= region.endOffset) {
        if (firstIndex >= 0) break;
        continue;
      }
      if (firstIndex < 0) {
        firstIndex = i;
        firstOffsets = offsets;
      }
      lastIndex = i;
      lastOffsets = offsets;
    }

    if (firstIndex < 0 || lastIndex < firstIndex || !firstOffsets || !lastOffsets) continue;
    if (firstOffsets.start < region.startOffset || lastOffsets.end > region.endOffset) continue;

    const shortcode: ShortcodeParseResult = {
      name: "demo",
      attrs: parseShortcodeAttributes(region.attrsRaw),
      body: String(region.body || "")
    };
    const shortcodeNode = createShortcodeNode(shortcode);
    if (!shortcodeNode) continue;
    children.splice(firstIndex, lastIndex - firstIndex + 1, shortcodeNode);
    region.consumed = true;
  }
}

function readDemoOpenAttrs(node: unknown, sourceLocator: SourceLocator | null): string | null {
  if (!isNode(node) || node.type !== "paragraph") return null;
  const candidates = getParagraphCandidates(node, sourceLocator);
  for (const candidate of candidates) {
    const normalized = normalizeSmartQuotes(String(candidate || "")).trim();
    const openMatch = normalized.match(SHORTCODE_DEMO_OPEN);
    if (openMatch) return String(openMatch[1] || "");
    const openLooseMatch = normalized.match(/^demo\b([\s\S]*)$/i);
    if (!openLooseMatch) continue;
    const attrsRaw = String(openLooseMatch[1] || "").trim();
    if (!attrsRaw || !/[a-z][\w-]*\s*=/.test(attrsRaw)) continue;
    return attrsRaw;
  }
  return null;
}

function readDemoCloseInfo(node: unknown, sourceLocator: SourceLocator | null): { noteBeforeClose: string } | null {
  if (!isNode(node) || node.type !== "paragraph") return null;
  const candidates = getParagraphCandidates(node, sourceLocator);
  for (const candidate of candidates) {
    const normalized = normalizeSmartQuotes(String(candidate || ""));
    const closeMatch = normalized.match(/([\s\S]*?)\s*(?:\[\/demo\]|\/demo)\s*$/i);
    if (!closeMatch) continue;
    return { noteBeforeClose: String(closeMatch[1] || "").trim() };
  }
  return null;
}

function buildDemoShortcodeFromNodes(nodes: unknown[], attrs: Record<string, string>): ShortcodeParseResult | null {
  if (!Array.isArray(nodes) || !nodes.length) return null;
  const codeNode = nodes.find(
    (node) => isNode(node) && node.type === "code" && typeof node.value === "string" && String(node.value || "").trim()
  ) as MdNode | undefined;
  if (!codeNode) return null;

  const lang = String(attrs.lang || codeNode.lang || "text").trim().toLowerCase() || "text";
  const code = String(codeNode.value || "").replace(/\r\n?/g, "\n").trim();
  if (!code) return null;

  const notes: string[] = [];
  for (const node of nodes) {
    if (!isNode(node) || node === codeNode) continue;
    if (node.type === "paragraph") {
      const text = normalizeSmartQuotes(getParagraphText(node)).trim();
      if (text) notes.push(text);
    }
  }

  const body = [`\`\`\`${lang}`, code, "\`\`\`", notes.join("\n\n")].filter(Boolean).join("\n");
  return {
    name: "demo",
    attrs,
    body
  };
}

function parseBooleanAttr(rawValue: string | undefined, fallback = false): boolean {
  if (typeof rawValue !== "string") return fallback;
  const value = rawValue.trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

function sanitizeVideoUrl(rawValue: string | undefined): string {
  const raw = normalizeSmartQuotes(String(rawValue || "")).trim();
  if (!raw) return "";
  const decoded = decodeUrlSafely(raw)
    .replace(/%22%5D%5B\/?video.*$/i, "")
    .replace(/\[\/video.*$/i, "")
    .replace(/[)\]"'\u201c\u201d\u2018\u2019]+$/g, "")
    .trim();
  if (!decoded) return "";
  if (/^(https?:)?\/\//i.test(decoded)) return decoded;
  if (decoded.startsWith("/") || decoded.startsWith("./") || decoded.startsWith("../")) return decoded;
  return "";
}

function sanitizePositiveInt(rawValue: string | undefined, max = 1920): number | undefined {
  const value = Number.parseInt(String(rawValue || "").trim(), 10);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(value, max);
}

function normalizeHiddenType(rawValue: string | undefined): string {
  const value = String(rawValue || "").trim().toLowerCase();
  if (HIDDEN_TYPES.has(value)) return value;
  return "background";
}

function normalizeAdmonitionColor(rawValue: string | undefined): string {
  const value = String(rawValue || "").trim().toLowerCase();
  if (ADMONITION_COLORS.has(value)) return value;
  return "indigo";
}

function normalizeDemoMode(rawValue: string | undefined): "split" | "stack" {
  const value = String(rawValue || "").trim().toLowerCase();
  if (DEMO_MODES.has(value)) return value as "split" | "stack";
  return "split";
}

function normalizeDemoResult(rawValue: string | undefined): "auto" | "force" {
  const value = String(rawValue || "").trim().toLowerCase();
  if (DEMO_RESULTS.has(value)) return value as "auto" | "force";
  return "auto";
}

function parseDemoBody(rawValue: string, attrs: Record<string, string>) {
  const body = String(rawValue || "").replace(/\r\n?/g, "\n").trim();
  if (!body) return null;
  const fence = body.match(/```([a-z0-9-]*)[^\n]*\n([\s\S]*?)\n```/i);
  if (!fence) return null;

  const detectedLang = String(attrs.lang || fence[1] || "text").trim().toLowerCase() || "text";
  const code = String(fence[2] || "").replace(/\r\n?/g, "\n").trim();
  if (!code) return null;

  const before = body.slice(0, fence.index || 0).trim();
  const after = body.slice((fence.index || 0) + fence[0].length).trim();
  const notes = [before, after].filter(Boolean).join("\n\n").trim();
  return { lang: detectedLang, code, notes };
}

function getAdmonitionIconGlyph(rawValue: string | undefined): string {
  const icon = String(rawValue || "").trim().toLowerCase();
  if (!icon) return "";
  const iconMap: Record<string, string> = {
    flag: "\u2691",
    info: "\u2139",
    warning: "\u26a0",
    danger: "\u26d4",
    tip: "\ud83d\udca1",
    check: "\u2714",
    star: "\u2605"
  };
  return iconMap[icon] || icon.slice(0, 1).toUpperCase();
}

function createShortcodeNode(result: ShortcodeParseResult): MdNode | null {
  const body = String(result.body || "").trim();

  if (result.name === "video") {
    const src = sanitizeVideoUrl(result.attrs.url);
    if (!src) return null;
    const width = sanitizePositiveInt(result.attrs.width, 2560);
    const height = sanitizePositiveInt(result.attrs.height, 1440);
    const autoplay = parseBooleanAttr(result.attrs.autoplay, false);
    const videoProps: Record<string, unknown> = {
      className: ["mdx-video-player"],
      src,
      controls: true,
      preload: "metadata",
      playsinline: true,
      width,
      height
    };
    if (autoplay) {
      videoProps.autoplay = true;
      videoProps.muted = true;
    }
    const children: unknown[] = [createElement("video", videoProps, [])];
    if (body) {
      children.push(createElement("figcaption", { className: ["mdx-video-caption"] }, [createText(body)]));
    }
    return createElement("figure", { className: ["mdx-video"] }, children);
  }

  if (result.name === "checkbox") {
    const checked = parseBooleanAttr(result.attrs.checked, false);
    return createElement(
      "label",
      { className: ["mdx-checkbox"], "data-checked": checked ? "1" : "0" },
      [
        createElement("input", { className: ["mdx-checkbox-input"], type: "checkbox", checked: checked ? true : undefined }, []),
        createElement("span", { className: ["mdx-checkbox-label"] }, [createText(body)])
      ]
    );
  }

  if (result.name === "hidden") {
    const hiddenType = normalizeHiddenType(result.attrs.type);
    const tip = String(result.attrs.tip || "").trim();
    const props: Record<string, unknown> = {
      className: ["mdx-hidden", `mdx-hidden-${hiddenType}`],
      type: "button",
      "data-hidden-type": hiddenType,
      "data-revealed": "0",
      "aria-expanded": "false"
    };
    if (tip) {
      props.title = tip;
      props["data-tip"] = tip;
    }
    return createElement("button", props, [createElement("span", { className: ["mdx-hidden-text"] }, [createText(body)])]);
  }

  if (result.name === "callout") {
    const type = String(result.attrs.type || "info").trim().toLowerCase();
    const map: Record<string, { color: string; icon: string; title: string }> = {
      tip: { color: "indigo", icon: "tip", title: "提示" },
      info: { color: "blue", icon: "info", title: "信息" },
      warning: { color: "orange", icon: "warning", title: "注意" },
      danger: { color: "red", icon: "danger", title: "危险" },
      success: { color: "green", icon: "check", title: "成功" },
      important: { color: "indigo", icon: "flag", title: "重要" },
      note: { color: "grey", icon: "info", title: "说明" }
    };
    const preset = map[type] || map.info;
    const normalized: ShortcodeParseResult = {
      name: "admonition",
      attrs: {
        ...result.attrs,
        color: String(result.attrs.color || preset.color),
        icon: String(result.attrs.icon || preset.icon),
        title: String(result.attrs.title || preset.title)
      },
      body
    };
    return createShortcodeNode(normalized);
  }

  if (result.name === "demo") {
    const parsed = parseDemoBody(body, result.attrs);
    if (!parsed) return null;
    const mode = normalizeDemoMode(result.attrs.mode);
    const previewResult = normalizeDemoResult(result.attrs.result);
    const title = String(result.attrs.title || "").trim();
    const sourceCodeNode = { type: "code", lang: parsed.lang, value: parsed.code } as MdNode;
    const previewCodeNode = { type: "code", lang: parsed.lang, value: parsed.code } as MdNode;

    const sourceChildren: unknown[] = [createElement("div", { className: ["md-demo-label"] }, [createText("语法写法")]), sourceCodeNode];
    const previewChildren: unknown[] = [createElement("div", { className: ["md-demo-label"] }, [createText("效果展示")]), previewCodeNode];
    if (parsed.notes) {
      previewChildren.push(createElement("div", { className: ["md-demo-note"] }, [createParagraph(parsed.notes)]));
    }

    const wrapperChildren: unknown[] = [];
    if (title) {
      wrapperChildren.push(createElement("header", { className: ["md-demo-head"] }, [createText(title)]));
    }
    wrapperChildren.push(
      createElement("div", { className: ["md-demo-body"] }, [
        createElement("section", { className: ["md-demo-source"] }, sourceChildren),
        createElement("section", { className: ["md-demo-preview"], "data-result": previewResult }, previewChildren)
      ])
    );

    return createElement(
      "section",
      {
        className: ["md-demo"],
        "data-mode": mode,
        "data-result": previewResult,
        "data-demo-lang": parsed.lang
      },
      wrapperChildren
    );
  }

  if (result.name === "admonition") {
    const title = String(result.attrs.title || "").trim();
    const color = normalizeAdmonitionColor(result.attrs.color);
    const iconName = String(result.attrs.icon || "").trim();
    const iconGlyph = getAdmonitionIconGlyph(iconName);
    const children: unknown[] = [];

    if (title || iconGlyph) {
      const headerChildren: unknown[] = [];
      if (iconGlyph) {
        headerChildren.push(
          createElement(
            "span",
            { className: ["mdx-admonition-icon"], "data-icon-name": iconName.toLowerCase() || undefined, "aria-hidden": "true" },
            [createText(iconGlyph)]
          )
        );
      }
      if (title) {
        headerChildren.push(createElement("span", { className: ["mdx-admonition-title"] }, [createText(title)]));
      }
      children.push(createElement("header", { className: ["mdx-admonition-head"] }, headerChildren));
    }
    if (body) {
      children.push(createElement("div", { className: ["mdx-admonition-body"] }, [createParagraph(body)]));
    }
    return createElement("section", { className: ["mdx-admonition", `mdx-admonition-${color}`], "data-color": color }, children);
  }

  return null;
}

function addClass(node: { data?: Record<string, unknown> }, className: string) {
  node.data ||= {};
  const rawProps = (node.data.hProperties as Record<string, unknown> | undefined) ?? {};
  const rawClass = rawProps.className;
  const list = Array.isArray(rawClass)
    ? rawClass.filter((item) => typeof item === "string")
    : typeof rawClass === "string"
      ? [rawClass]
      : [];
  if (!list.includes(className)) list.push(className);
  node.data.hProperties = { ...rawProps, className: list };
}

function stripTrailingFenceFromList(listNode: { children?: unknown[] }) {
  if (!Array.isArray(listNode.children) || listNode.children.length === 0) return;
  const lastItem = listNode.children[listNode.children.length - 1];
  if (!isNode(lastItem) || !Array.isArray(lastItem.children)) return;

  for (let i = lastItem.children.length - 1; i >= 0; i -= 1) {
    const child = lastItem.children[i];
    if (!isNode(child) || child.type !== "paragraph") continue;
    const raw = getParagraphText(child);
    if (!raw) continue;

    const stripped = raw.replace(/(?:\r?\n)?\s*:{4}\s*$/m, "").trimEnd();
    if (stripped === raw.trimEnd()) continue;

    if (!stripped.trim()) {
      lastItem.children.splice(i, 1);
    } else {
      child.children = [createText(stripped)];
    }
    break;
  }
}

function parseIconSpec(rawInput: string) {
  const raw = String(rawInput || "").trim();
  if (!raw) return null;
  const [iconName, ...restParts] = raw.split(/\s+/);
  if (!/^[a-z0-9-]+:[a-z0-9-]+$/i.test(iconName)) return null;

  const rest = restParts.join(" ").trim();
  let size = "";
  let color = "";

  if (rest) {
    if (rest.includes("/")) {
      const [sizePart, colorPart] = rest.split("/");
      size = String(sizePart || "").trim();
      color = String(colorPart || "").trim();
    } else if (rest.startsWith("/")) {
      color = rest.slice(1).trim();
    } else {
      size = rest;
    }
  }

  if (size && !/^\d{1,3}px$/i.test(size)) size = "";
  if (color && !/^#([0-9a-f]{3,8})$/i.test(color) && !/^[a-z]{3,20}$/i.test(color)) color = "";

  return { iconName, size, color };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function transformInlineText(value: string, options: ExtendedBuildOptions): Array<{ type: string; value: string }> | null {
  if (!value || (!options.enableMark && !options.enableIcon)) return null;
  let match: RegExpExecArray | null;
  let last = 0;
  let changed = false;
  const result: Array<{ type: string; value: string }> = [];
  INLINE_TOKEN.lastIndex = 0;

  while ((match = INLINE_TOKEN.exec(value)) !== null) {
    if (match.index > last) {
      result.push({ type: "text", value: value.slice(last, match.index) });
    }

    const rawToken = match[0];
    if (match[1]) {
      if (options.enableMark) {
        const markType = match[2];
        result.push({
          type: "html",
          value: `<mark class="md-mark md-mark-${markType}">${escapeHtml(match[1])}</mark>`
        });
        changed = true;
      } else {
        result.push({ type: "text", value: rawToken });
      }
    } else if (match[3]) {
      const icon = parseIconSpec(match[3]);
      if (icon && options.enableIcon) {
        const styleParts: string[] = [];
        if (icon.size) styleParts.push(`font-size:${icon.size}`);
        if (icon.color) styleParts.push(`color:${icon.color}`);
        const styleAttr = styleParts.length ? ` style="${escapeHtml(styleParts.join(";"))}"` : "";
        result.push({
          type: "html",
          value: `<iconify-icon class="md-inline-icon" icon="${escapeHtml(icon.iconName)}"${styleAttr}></iconify-icon>`
        });
        changed = true;
      } else {
        result.push({ type: "text", value: rawToken });
      }
    } else {
      result.push({ type: "text", value: rawToken });
    }

    last = match.index + rawToken.length;
  }

  if (!changed) return null;
  if (last < value.length) {
    result.push({ type: "text", value: value.slice(last) });
  }
  return result;
}

function transformInlineNodes(parent: { children?: unknown[] }, options: ExtendedBuildOptions) {
  if (!Array.isArray(parent.children)) return;
  for (let i = 0; i < parent.children.length; i += 1) {
    const node = parent.children[i];
    if (!isNode(node)) continue;
    if (node.type === "text" && typeof node.value === "string") {
      const replacement = transformInlineText(node.value, options);
      if (replacement) {
        parent.children.splice(i, 1, ...replacement);
        i += replacement.length - 1;
        continue;
      }
    }
    if (node.type === "code" || node.type === "inlineCode" || node.type === "html") continue;
    if (Array.isArray(node.children)) {
      transformInlineNodes(node as { children?: unknown[] }, options);
    }
  }
}

function processContainerBlocks(
  parent: { children?: unknown[] },
  options: ExtendedBuildOptions,
  state: { tabSeed: number; demoRegions: DemoRegion[] },
  sourceLocator: SourceLocator | null
) {
  if (!Array.isArray(parent.children)) return;
  const children = parent.children;
  const enableSteps = options.enableSteps !== false;
  const enableTabs = options.enableTabs !== false;
  const enableCodeGroup = options.enableCodeGroup !== false;
  const enableChartJs = options.enableChartJs !== false;
  const enableDemoBlock = options.enableDemoBlock !== false;
  const enableCalloutTemplates = options.enableCalloutTemplates !== false;
  if (enableDemoBlock && sourceLocator) {
    applyDemoRegionsToChildren(children, state.demoRegions, sourceLocator);
  }

  for (let i = 0; i < children.length; i += 1) {
    const current = children[i];
    if (!isNode(current)) continue;
    if (enableDemoBlock) {
      const demoAttrsRaw = readDemoOpenAttrs(current, sourceLocator);
      if (demoAttrsRaw !== null) {
        let closeIndex = -1;
        let closeInfo: { noteBeforeClose: string } | null = null;
        for (let cursor = i + 1; cursor < children.length; cursor += 1) {
          const info = readDemoCloseInfo(children[cursor], sourceLocator);
          if (info) {
            closeIndex = cursor;
            closeInfo = info;
            break;
          }
        }

        if (closeIndex > i) {
          const demoAttrs = parseShortcodeAttributes(demoAttrsRaw);
          const demoBodyNodes = [...children.slice(i + 1, closeIndex)];
          if (closeInfo?.noteBeforeClose) {
            demoBodyNodes.push(createParagraph(closeInfo.noteBeforeClose));
          }
          const shortcode = buildDemoShortcodeFromNodes(demoBodyNodes, demoAttrs);
          const shortcodeNode = shortcode ? createShortcodeNode(shortcode) : null;
          if (shortcodeNode) {
            children.splice(i, closeIndex - i + 1, shortcodeNode);
            i -= 1;
            continue;
          }
        }
      }
    }

    if (current.type === "paragraph") {
      const candidates = getParagraphCandidates(current, sourceLocator);
      if (candidates.length) {
        let replacedTabLines = false;
        for (const candidate of candidates) {
          const text = String(candidate || "");
          if (!/:::\s*tabs\b/i.test(text) || !/@tab\s+/i.test(text)) continue;
          let normalized = text;
          if (!/\r?\n/.test(normalized)) {
            normalized = normalized.replace(/:::\s*tabs\s*/i, (match) => `${match.trim()}\n`);
            normalized = normalized.replace(/\s+@tab\s+/gi, "\n@tab ");
          }
          const lines = normalized
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          if (lines.length < 2) continue;
          const splitNodes = lines.map((line) => createParagraph(line));
          children.splice(i, 1, ...splitNodes);
          i += splitNodes.length - 1;
          replacedTabLines = true;
          break;
        }
        if (replacedTabLines) continue;

        let replacedSequence = false;
        for (const candidate of candidates) {
          const shortcodes = parseShortcodeSequence(candidate);
          if (!shortcodes || shortcodes.length < 2) continue;
          const shortcodeNodes: unknown[] = [];
          let canReplace = true;
          for (const shortcode of shortcodes) {
            if (shortcode.name === "callout" && !enableCalloutTemplates) {
              canReplace = false;
              break;
            }
            if (shortcode.name === "demo" && !enableDemoBlock) {
              canReplace = false;
              break;
            }
            const shortcodeNode = createShortcodeNode(shortcode);
            if (!shortcodeNode) {
              canReplace = false;
              break;
            }
            shortcodeNodes.push(shortcodeNode);
          }
          if (!canReplace || !shortcodeNodes.length) continue;
          children.splice(i, 1, ...shortcodeNodes);
          i += shortcodeNodes.length - 1;
          replacedSequence = true;
          break;
        }
        if (replacedSequence) continue;

        let replacedShortcode = false;
        for (const candidate of candidates) {
          const shortcode = parseShortcode(candidate);
          if (!shortcode) continue;
          if (shortcode.name === "callout" && !enableCalloutTemplates) continue;
          if (shortcode.name === "demo" && !enableDemoBlock) continue;
          const shortcodeNode = createShortcodeNode(shortcode);
          if (!shortcodeNode) continue;
          children.splice(i, 1, shortcodeNode);
          i -= 1;
          replacedShortcode = true;
          break;
        }
        if (replacedShortcode) continue;
      }
    }
    const lines = getParagraphLines(current).filter(Boolean);
    const firstLine = lines[0] ?? "";

    if (enableSteps && (START_STEPS.test(firstLine) || START_STEPS_LOOSE.test(firstLine))) {
      const listNode = children[i + 1];
      if (isNode(listNode) && listNode.type === "list") {
        addClass(listNode, "md-steps");
        if (Array.isArray(listNode.children)) {
          listNode.children.forEach((item) => {
            if (isNode(item) && item.type === "listItem") addClass(item, "md-step-item");
          });
        }
        stripTrailingFenceFromList(listNode as { children?: unknown[] });

        let closeIndex = -1;
        for (let cursor = i + 2; cursor < children.length; cursor += 1) {
          const closeLines = getParagraphLines(children[cursor]);
          if (closeLines.some((line) => END_QUAD.test(line))) {
            closeIndex = cursor;
            break;
          }
        }

        if (closeIndex >= 0) {
          children.splice(closeIndex, 1);
        }
        children.splice(i, 1);
        i -= 1;
        continue;
      }
    }

    if (enableChartJs) {
      const chartStartIndex = findLineIndex(lines, START_CHART_LOOSE);
      if (chartStartIndex >= 0) {
        const startLine = lines[chartStartIndex] || "";
        const chartMatch = startLine.match(START_CHART);

        let closeIndex = -1;
        for (let cursor = i + 1; cursor < children.length; cursor += 1) {
          const closeLines = getParagraphLines(children[cursor]);
          if (closeLines.some((line) => END_TRIPLE.test(line))) {
            closeIndex = cursor;
            break;
          }
        }

        if (closeIndex > i + 1) {
          const leadingNodes = lines
            .slice(chartStartIndex + 1)
            .filter(Boolean)
            .map((line) => createParagraph(line));
          const between = [...leadingNodes, ...children.slice(i + 1, closeIndex)];
          const codeIndex = between.findIndex((node) => isNode(node) && node.type === "code");
          if (codeIndex >= 0) {
            const codeNode = between[codeIndex] as { value?: string };
            const chartConfig = String(codeNode.value || "").trim();
            if (chartConfig) {
              const notes = between.filter((_, idx) => idx !== codeIndex);
              const sectionChildren: unknown[] = [];
              const title = (chartMatch?.[1] || "").trim();
              if (title) {
                sectionChildren.push(createElement("header", { className: ["md-chartjs-head"] }, [createText(title)]));
              }
              sectionChildren.push(
                createElement("div", { className: ["md-chartjs-host"] }, [
                  createElement("canvas", { className: ["md-chartjs-canvas"], height: Number(options.chartHeight || 320) }, [])
                ])
              );
              if (notes.length) {
                sectionChildren.push(createElement("div", { className: ["md-chartjs-note"] }, notes));
              }
              const chartNode = createElement(
                "section",
                { className: ["md-chartjs"], "data-chartjs-config": chartConfig },
                sectionChildren
              );
              children.splice(i, closeIndex - i + 1, chartNode);
              i -= 1;
              continue;
            }
          }
        }
      }
    }

    if (enableCodeGroup) {
      const codeGroupStartIndex = findLineIndex(lines, START_CODE_GROUP_LOOSE);
      if (
        codeGroupStartIndex >= 0 &&
        (START_CODE_GROUP.test(lines[codeGroupStartIndex] || "") || START_CODE_GROUP_LOOSE.test(lines[codeGroupStartIndex] || ""))
      ) {
        let closeIndex = -1;
        for (let cursor = i + 1; cursor < children.length; cursor += 1) {
          const closeLines = getParagraphLines(children[cursor]);
          if (closeLines.some((line) => END_TRIPLE.test(line))) {
            closeIndex = cursor;
            break;
          }
        }

        if (closeIndex > i + 1) {
          const leadingNodes = lines
            .slice(codeGroupStartIndex + 1)
            .filter(Boolean)
            .map((line) => createParagraph(line));
          const between = [...leadingNodes, ...children.slice(i + 1, closeIndex)];
          const groups: Array<{ label: string; nodes: unknown[] }> = [];
          let currentGroup: { label: string; nodes: unknown[] } | null = null;

          const startCodeGroup = (label: string) => {
            currentGroup = { label: label.trim(), nodes: [] };
            groups.push(currentGroup);
          };

          const appendCodeNode = (node: unknown) => {
            if (!currentGroup) return;
            currentGroup.nodes.push(node);
          };

          between.forEach((node) => {
            if (isNode(node) && node.type === "paragraph") {
              const paraLines = getParagraphLines(node).filter(Boolean);
              if (!paraLines.length) return;
              if (paraLines.length === 1) {
                const labelMatch = paraLines[0]?.match(CODE_GROUP_LABEL);
                if (labelMatch) {
                  startCodeGroup(labelMatch[1]);
                  return;
                }
                appendCodeNode(node);
                return;
              }
              paraLines.forEach((line) => {
                const labelMatch = line.match(CODE_GROUP_LABEL);
                if (labelMatch) {
                  startCodeGroup(labelMatch[1]);
                  return;
                }
                appendCodeNode(createParagraph(line));
              });
              return;
            }
            appendCodeNode(node);
          });

          const validGroups = groups.filter(
            (group) => Array.isArray(group.nodes) && group.nodes.some((node) => isNode(node) && node.type === "code")
          );
          if (validGroups.length > 0) {
            state.tabSeed += 1;
            const groupSeed = state.tabSeed;
            const navChildren: unknown[] = [];
            const panelChildren: unknown[] = [];

            validGroups.forEach((group, idx) => {
              const isActive = idx === 0;
              const tabId = `md-code-group-${groupSeed}-${idx + 1}`;
              const panelId = `${tabId}-panel`;
              navChildren.push(
                createElement(
                  "button",
                  {
                    type: "button",
                    className: ["md-code-group-tab"],
                    id: tabId,
                    role: "tab",
                    "data-tab-id": tabId,
                    "data-active": isActive ? "1" : "0",
                    "aria-controls": panelId,
                    "aria-selected": isActive ? "true" : "false"
                  },
                  [createText(group.label)]
                )
              );

              panelChildren.push(
                createElement(
                  "section",
                  {
                    className: ["md-code-group-panel"],
                    id: panelId,
                    role: "tabpanel",
                    "aria-labelledby": tabId,
                    "data-active": isActive ? "1" : "0",
                    hidden: isActive ? undefined : true
                  },
                  group.nodes
                )
              );
            });

            const codeGroupNode = createElement("section", { className: ["md-code-group"] }, [
              createElement("div", { className: ["md-code-group-nav"], role: "tablist" }, navChildren),
              createElement("div", { className: ["md-code-group-panels"] }, panelChildren)
            ]);
            children.splice(i, closeIndex - i + 1, codeGroupNode);
            i -= 1;
            continue;
          }
        }
      }
    }

    if (enableTabs) {
      const tabsStartIndex = findLineIndex(lines, START_TABS_LOOSE);
      if (tabsStartIndex >= 0 && (START_TABS.test(lines[tabsStartIndex] || "") || START_TABS_LOOSE.test(lines[tabsStartIndex] || ""))) {
        let closeIndex = -1;
        for (let cursor = i + 1; cursor < children.length; cursor += 1) {
          const closeLines = getParagraphLines(children[cursor]);
          if (closeLines.some((line) => END_TRIPLE.test(line))) {
            closeIndex = cursor;
            break;
          }
        }

        if (closeIndex > i + 1) {
          const leadingNodes = lines
            .slice(tabsStartIndex + 1)
            .filter(Boolean)
            .map((line) => createParagraph(line));
          const between = [...leadingNodes, ...children.slice(i + 1, closeIndex)];
          const groups: Array<{ label: string; nodes: unknown[] }> = [];
          let currentGroup: { label: string; nodes: unknown[] } | null = null;

          const startTabGroup = (label: string) => {
            currentGroup = { label: label.trim(), nodes: [] };
            groups.push(currentGroup);
          };

          const appendTabNode = (node: unknown) => {
            if (!currentGroup) return;
            currentGroup.nodes.push(node);
          };

          between.forEach((node) => {
            if (isNode(node) && node.type === "paragraph") {
              const paraLines = getParagraphLines(node).filter(Boolean);
              if (!paraLines.length) return;
              if (paraLines.length === 1) {
                const labelMatch = paraLines[0]?.match(TAB_LABEL);
                if (labelMatch) {
                  startTabGroup(labelMatch[1]);
                  return;
                }
                appendTabNode(node);
                return;
              }
              paraLines.forEach((line) => {
                const labelMatch = line.match(TAB_LABEL);
                if (labelMatch) {
                  startTabGroup(labelMatch[1]);
                  return;
                }
                appendTabNode(createParagraph(line));
              });
              return;
            }
            appendTabNode(node);
          });

          if (groups.length > 0) {
            state.tabSeed += 1;
            const groupSeed = state.tabSeed;
            const navChildren: unknown[] = [];
            const panelChildren: unknown[] = [];

            groups.forEach((group, idx) => {
              const isActive = idx === 0;
              const tabId = `md-tab-${groupSeed}-${idx + 1}`;
              const panelId = `${tabId}-panel`;
              navChildren.push(
                createElement(
                  "button",
                  {
                    type: "button",
                    className: ["md-tabs-tab"],
                    id: tabId,
                    role: "tab",
                    "data-tab-id": tabId,
                    "data-active": isActive ? "1" : "0",
                    "aria-controls": panelId,
                    "aria-selected": isActive ? "true" : "false"
                  },
                  [createText(group.label)]
                )
              );

              panelChildren.push(
                createElement(
                  "section",
                  {
                    className: ["md-tabs-panel"],
                    id: panelId,
                    role: "tabpanel",
                    "aria-labelledby": tabId,
                    "data-active": isActive ? "1" : "0",
                    hidden: isActive ? undefined : true
                  },
                  group.nodes
                )
              );
            });

            const tabsNode = createElement("section", { className: ["md-tabs"] }, [
              createElement("div", { className: ["md-tabs-nav"], role: "tablist" }, navChildren),
              createElement("div", { className: ["md-tabs-panels"] }, panelChildren)
            ]);
            children.splice(i, closeIndex - i + 1, tabsNode);
            i -= 1;
            continue;
          }
        }
      }
    }

    if (Array.isArray(current.children)) {
      processContainerBlocks(current as { children?: unknown[] }, options, state, sourceLocator);
    }
  }
}

export function remarkExtendedBuild(options: ExtendedBuildOptions = {}) {
  return (tree: unknown, file?: { value?: unknown }) => {
    if (!isNode(tree)) return;
    const sourceText = typeof file?.value === "string" ? file.value : "";
    const state = { tabSeed: 0, demoRegions: collectDemoRegionsFromSource(sourceText) };
    const sourceLocator = createSourceLocator(sourceText);
    processContainerBlocks(tree as { children?: unknown[] }, options, state, sourceLocator);
    transformInlineNodes(tree as { children?: unknown[] }, options);
  };
}
