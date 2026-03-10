import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { CollectionEntry } from "astro:content";
import { normalizeTags as normalizeTagList } from "@/config/tag-normalize.config";
import {
  deriveTitleFromSourceStem,
  getCollectionContentBaseDir,
  getEntryAbsoluteFilePath,
  getEntrySourceStem,
  type ArticleCollection
} from "@/utils/content-source";

type ArticleEntry = CollectionEntry<ArticleCollection>;

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

function resolveSourceFilePath(entry: ArticleEntry): string | undefined {
  const key = `${entry.collection}:${entry.id}`;
  if (sourceFileCache.has(key)) {
    const cached = sourceFileCache.get(key);
    return cached || undefined;
  }

  const directFilePath = getEntryAbsoluteFilePath(entry);
  if (directFilePath && existsSync(directFilePath)) {
    sourceFileCache.set(key, directFilePath);
    return directFilePath;
  }

  const base = getCollectionContentBaseDir(entry.collection);
  const normalized = entry.id.replace(/\\/g, "/");
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

function resolveCreateTimeFromFile(absolutePath: string): Date {
  try {
    const stat = statSync(absolutePath);
    if (isValidDate(stat.birthtime) && stat.birthtime.getFullYear() > 1970) {
      return stat.birthtime;
    }
    if (isValidDate(stat.mtime)) return stat.mtime;
  } catch {
    // ignore
  }
  return new Date();
}

export function resolveDerivedTitle(entry: ArticleEntry): string {
  const raw = String(entry.data.title || "").trim();
  if (raw) return raw;
  return deriveTitleFromSourceStem(getEntrySourceStem(entry));
}

export function resolveDerivedCreateTimeText(entry: ArticleEntry): string {
  const key = `${entry.collection}:${entry.id}`;
  const explicit = String(entry.data.createTime || "").trim();
  if (explicit) return explicit;
  if (createTimeCache.has(key)) return createTimeCache.get(key)!;

  const source = resolveSourceFilePath(entry);
  const date = source ? resolveCreateTimeFromFile(source) : new Date();
  const formatted = formatDateTime(date);
  createTimeCache.set(key, formatted);
  return formatted;
}

export function resolveDerivedTags(tags: unknown): string[] {
  if (Array.isArray(tags) && tags.length) {
    const normalized = normalizeTagList(tags.map((item) => String(item || "")));
    return normalized.length ? normalized : ["Uncategorized"];
  }
  return ["Uncategorized"];
}
