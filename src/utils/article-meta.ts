import type { CollectionEntry } from "astro:content";
import siteConfig from "@/site.config";
import { resolveEntryCode } from "@/utils/content-code";
import { stripSlashes } from "@/utils/url";

type ArticleEntry =
  | CollectionEntry<"blog">
  | CollectionEntry<"tutorial">
  | CollectionEntry<"projects">;

type ArticleDefaults = typeof siteConfig.articleMeta.defaults;
type ArticleOverride = Partial<ArticleDefaults>;

export interface ResolvedArticleMeta {
  code: string;
  permalink: string;
  summary: string;
  description: string;
  tags: string[];
  createTime: Date;
  updatedTime?: Date;
  pubDate: Date;
  updatedDate?: Date;
  cover: string;
  showCover: boolean;
  draft: boolean;
  encrypted: boolean;
  encryptedFile: string;
  passwordHint: string;
  pinned: boolean;
  series: string;
  order: number;
  projectType: string;
  repoUrl: string;
  docUrl: string;
  demoUrl: string;
  featured: boolean;
  weight: number;
}

function pickText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickBoolean(...values: Array<unknown>): boolean {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
}

function pickNumber(fallback: number, ...values: Array<unknown>): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

function parseDateTime(value: unknown): Date | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  const matched = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (matched) {
    const [, y, m, d, hh, mm, ss] = matched;
    const utc = Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh) - 8,
      Number(mm),
      Number(ss)
    );
    const date = new Date(utc);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? undefined : fallback;
}

function pickDate(...values: Array<unknown>): Date | undefined {
  for (const value of values) {
    const date = parseDateTime(value);
    if (date) return date;
  }
  return undefined;
}

function normalizeTags(...values: Array<unknown>): string[] {
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    const tags = value
      .map((tag) => String(tag || "").trim())
      .filter(Boolean);
    if (tags.length) return [...new Set(tags)];
  }
  return [];
}

function normalizePermalink(input: string, code: string): string {
  const prefix = stripSlashes(siteConfig.articlePrefix || "/article");
  const fallback = `/${prefix}/${code}/`;
  const raw = String(input || "").trim();
  if (!raw) return fallback;

  const value = /^https?:\/\//i.test(raw)
    ? (() => {
        try {
          return new URL(raw).pathname;
        } catch {
          return raw;
        }
      })()
    : raw;

  let path = value.startsWith("/") ? value : `/${value}`;
  path = path.replace(/\/{2,}/g, "/");
  if (!path.endsWith("/")) path += "/";
  return path;
}

export function resolveArticleMeta(entry: ArticleEntry): ResolvedArticleMeta {
  const defaults: ArticleDefaults = siteConfig.articleMeta.defaults;
  const code = resolveEntryCode(entry);
  const override = (siteConfig.articleMeta.overridesByCode[code] ?? {}) as ArticleOverride;

  const summary = pickText(override.summary, entry.data.summary, defaults.summary);
  const description = pickText(override.description, summary, defaults.description, entry.data.title);
  const tags = normalizeTags(override.tags, entry.data.tags, defaults.tags);

  const createTime = pickDate(override.createTime, entry.data.createTime, defaults.createTime) ?? new Date("2026-01-01T00:00:00.000Z");
  const updatedTime = pickDate(override.updatedTime, defaults.updatedTime);
  const cover = pickText(override.cover, entry.data.cover, defaults.cover);
  const permalink = normalizePermalink(
    pickText(override.permalink, entry.data.permalink, defaults.permalink),
    code
  );

  return {
    code,
    permalink,
    summary,
    description,
    tags,
    createTime,
    updatedTime,
    pubDate: createTime,
    updatedDate: updatedTime,
    cover,
    showCover: pickBoolean(override.showCover, defaults.showCover),
    draft: pickBoolean(override.draft, defaults.draft),
    encrypted: pickBoolean(override.encrypted, defaults.encrypted),
    encryptedFile: pickText(override.encryptedFile, defaults.encryptedFile),
    passwordHint: pickText(override.passwordHint, defaults.passwordHint),
    pinned: pickBoolean(override.pinned, defaults.pinned),
    series: pickText(override.series, defaults.series),
    order: pickNumber(defaults.order, override.order),
    projectType: pickText(override.projectType, defaults.projectType),
    repoUrl: pickText(override.repoUrl, defaults.repoUrl),
    docUrl: pickText(override.docUrl, defaults.docUrl),
    demoUrl: pickText(override.demoUrl, defaults.demoUrl),
    featured: pickBoolean(override.featured, defaults.featured),
    weight: pickNumber(defaults.weight, override.weight)
  };
}
