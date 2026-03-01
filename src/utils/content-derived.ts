import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { CollectionEntry } from "astro:content";
import { normalizeTags as normalizeTagList } from "@/config/tag-normalize.config";

type ArticleCollection = "blog" | "tutorial" | "projects";
type ArticleEntry = CollectionEntry<ArticleCollection>;

const ROOT_DIR = process.cwd();
const CONTENT_BASE_DIR: Record<ArticleCollection, string> = {
  blog: path.join(ROOT_DIR, "src", "content", "blog"),
  tutorial: path.join(ROOT_DIR, "src", "content", "tutorial"),
  projects: path.join(ROOT_DIR, "src", "content", "projects")
};

const sourceFileCache = new Map<string, string | null>();
const createTimeCache = new Map<string, string>();

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function isValidDate(date: Date | undefined): date is Date {
  return Boolean(date) && !Number.isNaN(date.getTime());
}

function getFallbackTitleFromEntryId(entryId: string): string {
  const normalized = entryId.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  let stem = segments.at(-1) || normalized;
  stem = stem.replace(/\.(md|mdx)$/i, "");
  if (/^readme$/i.test(stem) && segments.length >= 2) {
    stem = segments.at(-2) || stem;
  }
  return stem.trim() || "未命名文章";
}

function resolveSourceFilePath(collection: ArticleCollection, entryId: string): string | undefined {
  const key = `${collection}:${entryId}`;
  if (sourceFileCache.has(key)) {
    const cached = sourceFileCache.get(key);
    return cached || undefined;
  }

  const base = CONTENT_BASE_DIR[collection];
  const normalized = entryId.replace(/\\/g, "/");
  const candidates = [
    path.join(base, normalized),
    path.join(base, `${normalized}.md`),
    path.join(base, `${normalized}.mdx`)
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      sourceFileCache.set(key, candidate);
      return candidate;
    }
  }

  sourceFileCache.set(key, null);
  return undefined;
}

function resolveGitFirstCommitDate(absolutePath: string): Date | undefined {
  const relativePath = path.relative(ROOT_DIR, absolutePath).replace(/\\/g, "/");
  const result = spawnSync(
    "git",
    ["log", "--diff-filter=A", "--follow", "--format=%aI", "-1", "--", relativePath],
    { cwd: ROOT_DIR, encoding: "utf8" }
  );
  if (result.status !== 0) return undefined;
  const iso = String(result.stdout || "").trim().split(/\r?\n/)[0]?.trim();
  if (!iso) return undefined;
  const date = new Date(iso);
  return isValidDate(date) ? date : undefined;
}

function resolveCreateTimeFromFile(absolutePath: string): Date {
  try {
    const stat = statSync(absolutePath);
    if (isValidDate(stat.birthtime) && stat.birthtime.getFullYear() > 1970) {
      return stat.birthtime;
    }
    const gitDate = resolveGitFirstCommitDate(absolutePath);
    if (isValidDate(gitDate)) return gitDate;
    if (isValidDate(stat.mtime)) return stat.mtime;
  } catch {
    // ignore
  }
  return new Date();
}

export function resolveDerivedTitle(entry: ArticleEntry): string {
  const raw = String(entry.data.title || "").trim();
  if (raw) return raw;
  return getFallbackTitleFromEntryId(entry.id);
}

export function resolveDerivedCreateTimeText(entry: ArticleEntry): string {
  const key = `${entry.collection}:${entry.id}`;
  const explicit = String(entry.data.createTime || "").trim();
  if (explicit) return explicit;
  if (createTimeCache.has(key)) return createTimeCache.get(key)!;

  const source = resolveSourceFilePath(entry.collection, entry.id);
  const date = source ? resolveCreateTimeFromFile(source) : new Date();
  const formatted = formatDateTime(date);
  createTimeCache.set(key, formatted);
  return formatted;
}

export function resolveDerivedTags(tags: unknown): string[] {
  if (Array.isArray(tags) && tags.length) {
    const normalized = normalizeTagList(tags.map((item) => String(item || "")));
    return normalized.length ? normalized : ["未分类"];
  }
  return ["未分类"];
}
