import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const targets = [
  path.join(root, "src", "content", "blog"),
  path.join(root, "src", "content", "tutorial"),
  path.join(root, "src", "content", "projects")
];

const ATTR_RE = /([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=]+))/gi;
const MERMAID_START_RE =
  /^(flowchart|graph|sequencediagram|classdiagram|statediagram|erdiagram|gantt|journey|gitgraph|pie|mindmap|timeline|quadrantchart|requirementdiagram|c4context|c4container|c4component|c4dynamic|c4deployment)\b/i;

function decodeSmartQuotes(input) {
  return String(input || "")
    .replace(/[\u201c\u201d\u2033\uff02]/g, "\"")
    .replace(/[\u2018\u2019\u2032\uff07]/g, "'");
}

function parseAttrs(rawAttrs) {
  const attrs = {};
  const normalized = decodeSmartQuotes(rawAttrs);
  ATTR_RE.lastIndex = 0;
  let match;
  while ((match = ATTR_RE.exec(normalized)) !== null) {
    const key = String(match[1] || "").trim().toLowerCase();
    if (!key) continue;
    attrs[key] = String(match[2] ?? match[3] ?? match[4] ?? "").trim();
  }
  return attrs;
}

function getLineByOffset(text, offset) {
  if (!text || offset <= 0) return 1;
  let line = 1;
  for (let i = 0; i < Math.min(offset, text.length); i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function parseChartOption(raw) {
  const text = String(raw || "").trim();
  if (!text.startsWith("{")) return { ok: false, reason: "chart config must be a JSON object" };
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, reason: "chart config must be an object" };
    }
    const hasSeries = Array.isArray(parsed.series) || Object.prototype.hasOwnProperty.call(parsed, "series");
    const hasAxes =
      Object.prototype.hasOwnProperty.call(parsed, "xAxis") || Object.prototype.hasOwnProperty.call(parsed, "yAxis");
    if (!hasSeries && !hasAxes) {
      return { ok: false, reason: "chart config requires series/xAxis/yAxis" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `invalid JSON (${error.message})` };
  }
}

function parseDemoBody(body) {
  const raw = String(body || "").replace(/\r\n?/g, "\n").trim();
  const fence = raw.match(/```([a-z0-9-]*)[^\n]*\n([\s\S]*?)\n```/i);
  if (!fence) return null;
  return {
    lang: String(fence[1] || "").trim().toLowerCase(),
    code: String(fence[2] || "").trim()
  };
}

function validateMermaid(raw) {
  const text = String(raw || "").trim();
  if (!text) return "mermaid block is empty";
  if (!MERMAID_START_RE.test(text)) return "mermaid block has no recognized diagram header";
  return null;
}

function validateDrawio(raw) {
  const text = String(raw || "").trim();
  if (!text) return "drawio block is empty";
  if (!/^https?:\/\/\S+\.drawio(\?.*)?$/i.test(text)) {
    return "drawio block must be a reachable .drawio URL";
  }
  return null;
}

async function walk(dir) {
  const output = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await walk(absolute)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!absolute.endsWith(".md") && !absolute.endsWith(".mdx")) continue;
    output.push(absolute);
  }
  return output;
}

function validateFrontmatter(data) {
  void data;
  return { warnings: [] };
}

function validateMarkdownContent(content) {
  const errors = [];
  const warnings = [];

  const fenceRe = /```([a-z0-9-]+)[^\n]*\n([\s\S]*?)\n```/gi;
  let fenceMatch;
  while ((fenceMatch = fenceRe.exec(content)) !== null) {
    const lang = String(fenceMatch[1] || "").trim().toLowerCase();
    const code = String(fenceMatch[2] || "");
    const line = getLineByOffset(content, fenceMatch.index);

    if (lang === "mermaid") {
      const message = validateMermaid(code);
      if (message) errors.push({ line, message });
      continue;
    }

    if (lang === "chart" || lang === "echarts") {
      const parsed = parseChartOption(code);
      if (!parsed.ok) errors.push({ line, message: parsed.reason });
      continue;
    }

    if (lang === "drawio") {
      const message = validateDrawio(code);
      if (message) errors.push({ line, message });
    }
  }

  const demoRe = /\[demo\b([^\]]*)\]([\s\S]*?)\[\/demo\]/gi;
  let demoMatch;
  while ((demoMatch = demoRe.exec(content)) !== null) {
    const attrs = parseAttrs(String(demoMatch[1] || ""));
    const body = String(demoMatch[2] || "");
    const line = getLineByOffset(content, demoMatch.index);

    const mode = String(attrs.mode || "").trim().toLowerCase();
    if (mode && mode !== "split" && mode !== "stack") {
      errors.push({ line, message: `demo mode "${mode}" is invalid (allowed: split|stack)` });
    }
    const result = String(attrs.result || "").trim().toLowerCase();
    if (result && result !== "auto" && result !== "force") {
      errors.push({ line, message: `demo result "${result}" is invalid (allowed: auto|force)` });
    }

    const parsed = parseDemoBody(body);
    if (!parsed) {
      errors.push({ line, message: "demo block requires a fenced code block" });
      continue;
    }
    if (!parsed.code) {
      errors.push({ line, message: "demo fenced code is empty" });
      continue;
    }

    const lang = String(attrs.lang || parsed.lang || "").trim().toLowerCase();
    if (lang === "mermaid") {
      const message = validateMermaid(parsed.code);
      if (message) errors.push({ line, message: `demo mermaid invalid: ${message}` });
    } else if (lang === "chart" || lang === "echarts") {
      const parsedChart = parseChartOption(parsed.code);
      if (!parsedChart.ok) errors.push({ line, message: `demo chart invalid: ${parsedChart.reason}` });
    } else if (lang === "drawio") {
      const message = validateDrawio(parsed.code);
      if (message) errors.push({ line, message: `demo drawio invalid: ${message}` });
    } else if (!lang) {
      warnings.push({ line, message: "demo block has no language, preview may not auto-render diagrams" });
    }
  }

  return { errors, warnings };
}

async function main() {
  const files = [];
  for (const dir of targets) {
    files.push(...(await walk(dir)));
  }

  const errors = [];
  const warnings = [];

  for (const file of files) {
    const rel = path.relative(root, file).replaceAll("\\", "/");
    const raw = await fs.readFile(file, "utf8");
    let parsed;
    try {
      parsed = matter(raw);
    } catch (error) {
      errors.push(`${rel}: invalid frontmatter (${error.message})`);
      continue;
    }

    const frontmatter = validateFrontmatter(parsed.data || {});
    frontmatter.warnings.forEach((message) => warnings.push(`${rel}: ${message}`));

    const contentValidation = validateMarkdownContent(parsed.content || "");
    contentValidation.errors.forEach((item) => errors.push(`${rel}:${item.line}: ${item.message}`));
    contentValidation.warnings.forEach((item) => warnings.push(`${rel}:${item.line}: ${item.message}`));
  }

  if (warnings.length) {
    console.warn("[guard:quality] warnings:");
    warnings.forEach((message) => console.warn(`- ${message}`));
  }

  if (errors.length) {
    console.error("[guard:quality] failed:");
    errors.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
  }

  console.log(`[guard:quality] ok (${files.length} files checked)`);
}

main().catch((error) => {
  console.error("[guard:quality] failed:", error);
  process.exit(1);
});
