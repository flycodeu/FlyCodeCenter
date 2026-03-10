import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import {
  createGeneratedCode,
  deriveTitleFromSourceStem,
  getSourceStemFromRelativePath,
  normalizePermalink,
  sanitizeManualCode
} from "./frontmatter-maintenance.mjs";

const root = process.cwd();
const siteBase = "";
const articleDefaults = {
  summary: "",
  description: "",
  tags: [],
  draft: false,
  encrypted: false
};
const outputPublic = path.join(root, "public", "search", "minisearch.json");
const outputDist = path.join(root, "dist", "search", "minisearch.json");

async function walk(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    const absolute = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...(await walk(absolute)));
    } else if (item.isFile() && (absolute.endsWith(".md") || absolute.endsWith(".mdx"))) {
      files.push(absolute);
    }
  }
  return files;
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_\-~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHeadingText(markdown) {
  return markdown
    .split("\n")
    .filter((line) => /^(#{2,3})\s+/.test(line))
    .map((line) => line.replace(/^#{2,3}\s+/, "").trim())
    .join(" ");
}

function ensureWithBase(url) {
  return `${siteBase}${url}`.replace(/\/{2,}/g, "/");
}

function pickText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
}

function normalizeTags(...values) {
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    const tags = value
      .map((tag) => String(tag || "").trim())
      .filter(Boolean);
    if (tags.length) return [...new Set(tags)];
  }
  return [];
}

function resolveCode(domain, relativeFile, data) {
  const manualCodeInput = typeof data.code === "string" ? data.code.trim() : "";
  const manualCode = manualCodeInput ? sanitizeManualCode(manualCodeInput) : "";
  if (manualCode) return manualCode;
  return createGeneratedCode(domain, relativeFile, getSourceStemFromRelativePath(relativeFile));
}

function resolvePermalink(domain, relativeFile, data) {
  const code = resolveCode(domain, relativeFile, data);
  return ensureWithBase(normalizePermalink(domain, data.permalink, code, relativeFile));
}

function getCollectionBases() {
  return {
    blog: path.join(root, "src", "content", "blog"),
    tutorial: path.join(root, "src", "content", "tutorial"),
    projects: path.join(root, "src", "content", "projects"),
    sites: path.join(root, "src", "content", "sites"),
    reading: path.join(root, "src", "content", "reading")
  };
}

function resolveUnifiedMeta(domain, relativeFile, data) {
  const defaults = articleDefaults;
  const code = resolveCode(domain, relativeFile, data);
  const summary = pickText(data.summary, defaults.summary);

  return {
    code,
    url: resolvePermalink(domain, relativeFile, data),
    title: pickText(data.title, deriveTitleFromSourceStem(getSourceStemFromRelativePath(relativeFile)), "Untitled"),
    description: pickText(data.description, summary, defaults.description),
    tags: normalizeTags(data.tags, defaults.tags),
    draft: pickBoolean(data.draft, defaults.draft),
    encrypted: pickBoolean(data.encrypted, defaults.encrypted)
  };
}

async function build() {
  const docs = [];
  const bases = getCollectionBases();

  const pushMarkdownDoc = (domain, relative, data, content) => {
    const meta = resolveUnifiedMeta(domain, relative, data);
    if (meta.draft || meta.encrypted) return;

    docs.push({
      id: `${domain}:${relative}`,
      code: meta.code,
      domain,
      title: meta.title,
      description: meta.description,
      content: stripMarkdown(content),
      headings: getHeadingText(content),
      tags: meta.tags.join(" "),
      url: meta.url
    });
  };

  for (const file of await walk(bases.blog)) {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    const relative = path.relative(bases.blog, file);
    pushMarkdownDoc("blog", relative, data, content);
  }

  for (const file of await walk(bases.tutorial)) {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    const relative = path.relative(bases.tutorial, file);
    pushMarkdownDoc("tutorial", relative, data, content);
  }

  for (const file of await walk(bases.projects)) {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    const relative = path.relative(bases.projects, file);
    pushMarkdownDoc("projects", relative, data, content);
  }

  for (const file of await walk(bases.sites)) {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    if (data.draft) continue;
    const relative = path.relative(bases.sites, file);
    const cardsText = (data.cards ?? [])
      .map((card) => [card.title, card.desc, (card.tags ?? []).join(" "), card.category].filter(Boolean).join(" "))
      .join(" ");
    docs.push({
      id: `sites:${relative}`,
      domain: "sites",
      title: data.title ?? "Untitled",
      description: data.description ?? "",
      content: stripMarkdown(`${content}\n${cardsText}`),
      headings: "",
      tags: (data.tags ?? []).join(" "),
      url: data.url ?? "/sites"
    });
  }

  for (const file of await walk(bases.reading)) {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    if (data.draft) continue;
    const relative = path.relative(bases.reading, file);
    docs.push({
      id: `reading:${relative}`,
      domain: "reading",
      title: data.title ?? "Untitled",
      description: data.description ?? "",
      content: stripMarkdown(content),
      headings: "",
      tags: (data.tags ?? []).join(" "),
      url: data.url ?? "/reading"
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    documents: docs
  };

  await fs.mkdir(path.dirname(outputPublic), { recursive: true });
  await fs.writeFile(outputPublic, JSON.stringify(payload), "utf8");

  try {
    await fs.mkdir(path.dirname(outputDist), { recursive: true });
    await fs.writeFile(outputDist, JSON.stringify(payload), "utf8");
  } catch {
    // dist may not exist during standalone runs
  }

  console.log(`[minisearch] indexed ${docs.length} documents`);
}

build().catch((error) => {
  console.error("[minisearch] build failed:", error);
  process.exit(1);
});
