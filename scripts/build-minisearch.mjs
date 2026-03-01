import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import siteConfig from "../src/site.config.ts";
import articleMetaConfig from "../src/config/article-meta.config.ts";

const root = process.cwd();
const articlePrefix = siteConfig.articlePrefix.replace(/^\/+|\/+$/g, "");
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
  const base = siteConfig.site.base === "/" ? "" : siteConfig.site.base;
  return `${base}${url}`.replace(/\/{2,}/g, "/");
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

function normalizeManualCode(input) {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function createGeneratedCode(domain, entryId, createTime) {
  const seed = `${domain}:${entryId}:${String(createTime || "").trim()}`;
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  const value = BigInt(`0x${hex}`).toString(36).slice(0, 8).padStart(8, "0");
  return /^\d/.test(value) ? `r${value.slice(1)}` : value;
}

function resolveCode(domain, relativeFile, data) {
  const manualCode = normalizeManualCode(data.code);
  if (manualCode) return manualCode;

  const normalized = relativeFile
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.(md|mdx)$/i, "");
  const entryId = domain === "projects" ? normalized.toLowerCase() : normalized;
  return createGeneratedCode(domain, entryId, data.createTime);
}

function normalizePermalink(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const value = /^https?:\/\//i.test(raw)
    ? (() => {
        try {
          return new URL(raw).pathname;
        } catch {
          return raw;
        }
      })()
    : raw;
  let pathname = value.startsWith("/") ? value : `/${value}`;
  pathname = pathname.replace(/\/{2,}/g, "/");
  if (!pathname.endsWith("/")) pathname += "/";
  return pathname;
}

function resolvePermalink(domain, relativeFile, data) {
  const defaults = articleMetaConfig.defaults ?? {};
  const code = resolveCode(domain, relativeFile, data);
  const override = articleMetaConfig.overridesByCode?.[code] ?? {};
  const configured = pickText(override.permalink, data.permalink, defaults.permalink);
  const fallback = `/${articlePrefix}/${code}/`;
  return ensureWithBase(normalizePermalink(configured || fallback));
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
  const defaults = articleMetaConfig.defaults ?? {};
  const code = resolveCode(domain, relativeFile, data);
  const override = articleMetaConfig.overridesByCode?.[code] ?? {};
  const summary = pickText(override.summary, data.summary, defaults.summary);

  return {
    code,
    url: resolvePermalink(domain, relativeFile, data),
    title: pickText(data.title, "Untitled"),
    description: pickText(override.description, summary, defaults.description),
    tags: normalizeTags(override.tags, data.tags, defaults.tags),
    draft: pickBoolean(override.draft, defaults.draft),
    encrypted: pickBoolean(override.encrypted, defaults.encrypted)
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
