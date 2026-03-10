import { createHash } from "node:crypto";
import path from "node:path";
import type { CollectionEntry } from "astro:content";

export type ArticleCollection = "blog" | "tutorial" | "projects";
export type ArticleEntry = CollectionEntry<ArticleCollection>;

const ROOT_DIR = process.cwd();
const CONTENT_BASE_DIR: Record<ArticleCollection, string> = {
  blog: path.join(ROOT_DIR, "src", "content", "blog"),
  tutorial: path.join(ROOT_DIR, "src", "content", "tutorial"),
  projects: path.join(ROOT_DIR, "src", "content", "projects")
};

const TITLE_ACRONYM_MAP: Record<string, string> = {
  ai: "AI",
  api: "API",
  css: "CSS",
  html: "HTML",
  http: "HTTP",
  https: "HTTPS",
  js: "JS",
  json: "JSON",
  llm: "LLM",
  mcp: "MCP",
  rag: "RAG",
  redis: "Redis",
  rss: "RSS",
  rtsp: "RTSP",
  sse: "SSE",
  sql: "SQL",
  ts: "TS",
  ui: "UI",
  ux: "UX",
  url: "URL",
  uuid: "UUID"
};

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function stripMarkdownExtension(value: string): string {
  return value.replace(/\.(md|mdx)$/i, "");
}

function stripReadmeSegment(segments: string[]): string[] {
  return segments.map((segment, index) => {
    if (index > 0 && /^readme$/i.test(segment)) return "";
    return segment;
  });
}

function normalizeSourceIdentity(value: string): string {
  return normalizeSlashes(stripMarkdownExtension(String(value || "")))
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function createShortHashCode(seed: string, prefix: string): string {
  const hex = createHash("sha1").update(seed).digest("hex").slice(0, 12);
  const encoded = BigInt(`0x${hex}`).toString(36).padStart(8, "0").slice(0, 8);
  return `${prefix}${encoded}`;
}

function formatAsciiTitleWord(word: string): string {
  const normalized = word.toLowerCase();
  return TITLE_ACRONYM_MAP[normalized] ?? normalized.replace(/^[a-z]/, (char) => char.toUpperCase());
}

export function getCollectionContentBaseDir(collection: ArticleCollection): string {
  return CONTENT_BASE_DIR[collection];
}

export function getEntryRepoRelativePath(entry: ArticleEntry): string | undefined {
  const filePath = String((entry as { filePath?: string }).filePath || "").trim();
  if (!filePath) return undefined;
  if (path.isAbsolute(filePath)) {
    return normalizeSlashes(path.relative(ROOT_DIR, filePath));
  }
  return normalizeSlashes(filePath.replace(/^\.\/+/, ""));
}

export function getEntryAbsoluteFilePath(entry: ArticleEntry): string | undefined {
  const repoRelativePath = getEntryRepoRelativePath(entry);
  if (!repoRelativePath) return undefined;
  return path.join(ROOT_DIR, repoRelativePath);
}

export function getEntrySourceRelativePath(entry: ArticleEntry): string | undefined {
  const absoluteFilePath = getEntryAbsoluteFilePath(entry);
  if (absoluteFilePath) {
    const baseDir = getCollectionContentBaseDir(entry.collection);
    const relativePath = normalizeSlashes(path.relative(baseDir, absoluteFilePath));
    if (relativePath && !relativePath.startsWith("../")) return relativePath;
  }

  const repoRelativePath = getEntryRepoRelativePath(entry);
  if (repoRelativePath) {
    const marker = `src/content/${entry.collection}/`;
    const index = repoRelativePath.toLowerCase().indexOf(marker.toLowerCase());
    if (index >= 0) {
      return repoRelativePath.slice(index + marker.length);
    }
  }

  return normalizeSlashes(String(entry.id || "").trim()) || undefined;
}

export function getStemFromSourcePath(sourcePath: string): string {
  const normalized = normalizeSlashes(sourcePath);
  const segments = stripReadmeSegment(
    normalized
      .split("/")
      .filter(Boolean)
      .map((segment) => stripMarkdownExtension(segment))
  ).filter(Boolean);
  return segments.at(-1) || stripMarkdownExtension(path.basename(normalized)) || "";
}

export function getEntrySourceStem(entry: ArticleEntry): string {
  return getStemFromSourcePath(getEntrySourceRelativePath(entry) || String(entry.id || ""));
}

export function deriveTitleFromSourceStem(stem: string): string {
  let title = stripMarkdownExtension(String(stem || "").trim());
  if (!title) return "Untitled Article";

  if (/^[0-9]{1,4}[-_].+/.test(title) && /^[a-z0-9#+._-]+$/i.test(title)) {
    title = title.replace(/^[0-9]{1,4}[-_]+/, "");
  }

  if (/[-_]/.test(title) && /^[a-z0-9#+._ -]+$/i.test(title)) {
    const words = title
      .replace(/[_-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => formatAsciiTitleWord(word));
    return words.join(" ").trim() || "Untitled Article";
  }

  return title;
}

export function createGeneratedCodeFromSourcePath(input: {
  collection: ArticleCollection;
  sourcePath?: string;
  fallback?: string;
}): string {
  const normalizedSourcePath = normalizeSlashes(String(input.sourcePath || "").trim());
  const segments = stripReadmeSegment(
    normalizedSourcePath
      .split("/")
      .filter(Boolean)
      .map((segment) => stripMarkdownExtension(segment))
  ).filter(Boolean);
  const identity = normalizeSourceIdentity(segments.join("/"));
  const fallback = normalizeSourceIdentity(input.fallback || input.collection || "article");
  const seed = `${input.collection}:${identity || fallback || "article"}`;
  return createShortHashCode(seed, input.collection.slice(0, 1).toLowerCase() || "a");
}

export function sanitizeManualCode(input: string): string {
  return String(input || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
