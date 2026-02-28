import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import siteConfig from "../src/site.config.ts";

const root = process.cwd();
const articlePrefix = siteConfig.articlePrefix.replace(/^\/+|\/+$/g, "");
const outputPublic = path.join(root, "public", "search", "minisearch.json");
const outputDist = path.join(root, "dist", "search", "minisearch.json");

const codePrefixMap = {
  blog: "B",
  tutorial: "T",
  projects: "P"
};

async function walk(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    const absolute = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...(await walk(absolute)));
    } else if (item.isFile() && absolute.endsWith(".md")) {
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

function normalizeManualCode(input) {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-_]/g, "");
}

function resolveCode(domain, relativeFile, data) {
  const manualCode = normalizeManualCode(data.code);
  if (manualCode) return manualCode;

  const prefix = codePrefixMap[domain];
  const normalized = relativeFile.replace(/\\/g, "/").replace(/^\/+/, "");
  const seed = `${domain}:${normalized}`;
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 8).toUpperCase();
  return `${prefix}-${digest}`;
}

function getBlogUrl(relativeFile, data) {
  const code = resolveCode("blog", relativeFile, data);
  return ensureWithBase(`/${articlePrefix}/${code}`);
}

function getTutorialUrl(relativeFile, data) {
  const code = resolveCode("tutorial", relativeFile, data);
  return ensureWithBase(`/${articlePrefix}/${code}`);
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

function getProjectUrl(relativeFile, data) {
  const code = resolveCode("projects", relativeFile, data);
  return ensureWithBase(`/${articlePrefix}/${code}`);
}

async function build() {
  const docs = [];
  const bases = getCollectionBases();

  const pushMarkdownDoc = (domain, relative, data, content, url) => {
    docs.push({
      id: `${domain}:${relative}`,
      code: resolveCode(domain, relative, data),
      domain,
      title: data.title ?? "Untitled",
      description: data.description ?? "",
      content: stripMarkdown(content),
      headings: getHeadingText(content),
      tags: (data.tags ?? []).join(" "),
      url
    });
  };

  for (const file of await walk(bases.blog)) {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    if (data.draft || data.encrypted) continue;
    const relative = path.relative(bases.blog, file);
    pushMarkdownDoc("blog", relative, data, content, getBlogUrl(relative, data));
  }

  for (const file of await walk(bases.tutorial)) {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    if (data.draft || data.encrypted) continue;
    const relative = path.relative(bases.tutorial, file);
    pushMarkdownDoc("tutorial", relative, data, content, getTutorialUrl(relative, data));
  }

  for (const file of await walk(bases.projects)) {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    if (data.draft || data.encrypted) continue;
    const relative = path.relative(bases.projects, file);
    pushMarkdownDoc("projects", relative, data, content, getProjectUrl(relative, data));
  }

  for (const file of await walk(bases.sites)) {
    const raw = await fs.readFile(file, "utf8");
    const { data, content } = matter(raw);
    if (data.draft) continue;
    const relative = path.relative(bases.sites, file);
    docs.push({
      id: `sites:${relative}`,
      domain: "sites",
      title: data.title ?? "Untitled",
      description: data.description ?? "",
      content: stripMarkdown(content),
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
