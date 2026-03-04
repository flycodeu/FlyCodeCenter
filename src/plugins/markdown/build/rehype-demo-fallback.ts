interface RehypeDemoFallbackOptions {
  enableDemoBlock?: boolean;
}

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const DEMO_OPEN_LINE = /^\[demo\b([^\]]*)\]\s*$/i;
const SHORTCODE_ATTR = /([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=]+))/gi;

function isNode(value: unknown): value is HastNode {
  return Boolean(value && typeof value === "object");
}

function isElement(node: unknown): node is HastNode {
  return isNode(node) && node.type === "element" && typeof node.tagName === "string";
}

function getChildren(node: unknown): HastNode[] {
  if (!isNode(node) || !Array.isArray(node.children)) return [];
  return node.children;
}

function normalizeSmartQuotes(input: string): string {
  return String(input || "")
    .replace(/[\u201c\u201d\u2033\uff02]/g, "\"")
    .replace(/[\u2018\u2019\u2032\uff07]/g, "'");
}

function normalizeLanguage(raw: string): string {
  const value = String(raw || "").trim().toLowerCase();
  if (!value || value === "plaintext" || value === "plain") return "text";
  return value;
}

function normalizeClassList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof raw === "string") {
    return raw
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function hasClass(node: HastNode, className: string): boolean {
  if (!isElement(node)) return false;
  const classNameRaw = node.properties?.className;
  return normalizeClassList(classNameRaw).includes(className);
}

function extractText(node: unknown): string {
  if (!isNode(node)) return "";
  if (node.type === "text") return typeof node.value === "string" ? node.value : "";
  if (node.type === "element" && node.tagName === "br") return "\n";
  const children = getChildren(node);
  if (!children.length) return "";
  return children.map((child) => extractText(child)).join("");
}

function parseShortcodeAttributes(rawAttrs: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const normalized = normalizeSmartQuotes(rawAttrs);
  SHORTCODE_ATTR.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  while ((match = SHORTCODE_ATTR.exec(normalized)) !== null) {
    const key = String(match[1] || "").trim().toLowerCase();
    if (!key) continue;
    attrs[key] = String(match[2] ?? match[3] ?? match[4] ?? "").trim();
  }
  return attrs;
}

function parseDemoOpen(node: HastNode): { attrsRaw: string } | null {
  if (!isElement(node) || node.tagName !== "p") return null;
  const raw = normalizeSmartQuotes(extractText(node)).trim();
  if (!raw) return null;

  const match = raw.match(DEMO_OPEN_LINE);
  if (match) {
    return { attrsRaw: String(match[1] || "") };
  }

  const loose = raw.match(/^demo\b([\s\S]*)$/i);
  if (!loose) return null;
  const attrsRaw = String(loose[1] || "").trim();
  if (!attrsRaw || !/[a-z][\w-]*\s*=/.test(attrsRaw)) return null;
  return { attrsRaw };
}

function parseDemoClose(node: HastNode): { noteBeforeClose: string } | null {
  if (!isElement(node) || node.tagName !== "p") return null;
  const raw = normalizeSmartQuotes(extractText(node));
  const match = raw.match(/([\s\S]*?)\s*(?:\[\/demo\]|\/demo)\s*$/i);
  if (!match) return null;
  return { noteBeforeClose: String(match[1] || "").trim() };
}

function isCodeHost(node: HastNode): boolean {
  if (!isElement(node)) return false;
  if (node.tagName === "pre") return true;
  if (hasClass(node, "expressive-code")) return true;
  if (hasClass(node, "code-block-wrapper")) return true;
  return false;
}

function findFirstCodeHost(node: HastNode): HastNode | null {
  if (!isElement(node)) return null;
  if (isCodeHost(node)) return node;
  const children = getChildren(node);
  for (const child of children) {
    const matched = findFirstCodeHost(child);
    if (matched) return matched;
  }
  return null;
}

function findFirstPre(node: HastNode): HastNode | null {
  if (!isElement(node)) return null;
  if (node.tagName === "pre") return node;
  const children = getChildren(node);
  for (const child of children) {
    const matched = findFirstPre(child);
    if (matched) return matched;
  }
  return null;
}

function cloneNode<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createText(value: string): HastNode {
  return { type: "text", value };
}

function createElement(tagName: string, properties: Record<string, unknown> = {}, children: HastNode[] = []): HastNode {
  return { type: "element", tagName, properties, children };
}

function createParagraph(value: string): HastNode {
  return createElement("p", {}, [createText(value)]);
}

function inferCodeLanguage(sourceNode: HastNode, attrs: Record<string, string>): string {
  const explicit = normalizeLanguage(attrs.lang || "");
  if (explicit !== "text" || String(attrs.lang || "").trim()) return explicit;

  const preNode = findFirstPre(sourceNode);
  if (!preNode || !isElement(preNode)) return "text";

  const dataLanguage = preNode.properties?.["data-language"];
  if (typeof dataLanguage === "string" && dataLanguage.trim()) {
    return normalizeLanguage(dataLanguage);
  }
  const dataLanguageCamel = preNode.properties?.dataLanguage;
  if (typeof dataLanguageCamel === "string" && dataLanguageCamel.trim()) {
    return normalizeLanguage(dataLanguageCamel);
  }

  const codeChild = getChildren(preNode).find((child) => isElement(child) && child.tagName === "code");
  if (codeChild && isElement(codeChild)) {
    const classRaw = codeChild.properties?.className;
    const classes = normalizeClassList(classRaw);
    const languageClass = classes.find((item) => /^language-[a-z0-9-]+$/i.test(item));
    if (languageClass) {
      return normalizeLanguage(languageClass.replace(/^language-/i, ""));
    }
  }
  return "text";
}

function buildDemoNode(attrsRaw: string, sourceNode: HastNode, noteText: string): HastNode {
  const attrs = parseShortcodeAttributes(attrsRaw);
  const mode = String(attrs.mode || "").trim().toLowerCase() === "stack" ? "stack" : "split";
  const result = String(attrs.result || "").trim().toLowerCase() === "force" ? "force" : "auto";
  const title = String(attrs.title || "").trim();
  const lang = inferCodeLanguage(sourceNode, attrs);

  const sourceChildren: HastNode[] = [
    createElement("div", { className: ["md-demo-label"] }, [createText("语法写法")]),
    cloneNode(sourceNode)
  ];
  const previewChildren: HastNode[] = [
    createElement("div", { className: ["md-demo-label"] }, [createText("效果展示")]),
    cloneNode(sourceNode)
  ];

  const normalizedNote = String(noteText || "").trim();
  if (normalizedNote) {
    const blocks = normalizedNote
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => createParagraph(item));
    if (blocks.length) {
      previewChildren.push(createElement("div", { className: ["md-demo-note"] }, blocks));
    }
  }

  const wrapperChildren: HastNode[] = [];
  if (title) {
    wrapperChildren.push(createElement("header", { className: ["md-demo-head"] }, [createText(title)]));
  }
  wrapperChildren.push(
    createElement("div", { className: ["md-demo-body"] }, [
      createElement("section", { className: ["md-demo-source"] }, sourceChildren),
      createElement("section", { className: ["md-demo-preview"], "data-result": result }, previewChildren)
    ])
  );

  return createElement(
    "section",
    {
      className: ["md-demo"],
      "data-mode": mode,
      "data-result": result,
      "data-demo-lang": lang
    },
    wrapperChildren
  );
}

function transformDemoShortcodes(parent: HastNode) {
  const children = getChildren(parent);
  if (!children.length) return;

  for (let i = 0; i < children.length; i += 1) {
    const current = children[i];
    if (!current) continue;

    const openInfo = parseDemoOpen(current);
    if (openInfo) {
      let closeIndex = -1;
      let sourceNode: HastNode | null = null;
      const noteParts: string[] = [];

      for (let cursor = i + 1; cursor < children.length; cursor += 1) {
        const candidate = children[cursor];
        if (!candidate) continue;
        const codeHost = findFirstCodeHost(candidate);
        if (!sourceNode && codeHost) {
          sourceNode = codeHost;
        }

        const closeInfo = parseDemoClose(candidate);
        if (closeInfo) {
          closeIndex = cursor;
          if (closeInfo.noteBeforeClose) {
            noteParts.push(closeInfo.noteBeforeClose);
          }
          break;
        }

        if (!codeHost) {
          const note = normalizeSmartQuotes(extractText(candidate)).trim();
          if (note) noteParts.push(note);
        }
      }

      if (closeIndex > i && sourceNode) {
        const demoNode = buildDemoNode(openInfo.attrsRaw, sourceNode, noteParts.join("\n\n"));
        children.splice(i, closeIndex - i + 1, demoNode);
        i -= 1;
        continue;
      }
    }

    if (Array.isArray(current.children) && current.children.length) {
      transformDemoShortcodes(current);
    }
  }
}

export function rehypeDemoFallback(options: RehypeDemoFallbackOptions = {}) {
  return (tree: unknown) => {
    if (options.enableDemoBlock === false) return;
    if (!isNode(tree)) return;
    transformDemoShortcodes(tree);
  };
}
