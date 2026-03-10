import type { CollectionEntry } from "astro:content";
import siteConfig from "@/site.config";
import { normalizeTags as normalizeTagList } from "@/config/tag-normalize.config";
import { resolveEntryCode } from "@/utils/content-code";
import { buildCollectionCodePermalink, buildTutorialSeriesPermalink } from "@/utils/content-route";
import { getEntrySourceRelativePath } from "@/utils/content-source";
import {
  resolveDerivedCreateTimeText,
  resolveDerivedTags,
  resolveDerivedTitle
} from "@/utils/content-derived";
import { isTutorialReadmeEntryId, toSeriesRouteKey } from "@/utils/tutorial-route";

type ArticleEntry =
  | CollectionEntry<"blog">
  | CollectionEntry<"tutorial">
  | CollectionEntry<"projects">;
type CoverMode = "left" | "right" | "top" | "none";

type ArticleDefaults = typeof siteConfig.articleMeta.defaults;
type ArticleOverride = Partial<ArticleDefaults>;
const articleMetaCache = new WeakMap<ArticleEntry, ResolvedArticleMeta>();

function resolveSourceOverrideKey(entry: ArticleEntry): string {
  const sourcePath = getEntrySourceRelativePath(entry);
  return `${entry.collection}/${String(sourcePath || entry.id || "").replace(/\\/g, "/")}`;
}

export interface ResolvedArticleMeta {
  title: string;
  code: string;
  permalink: string;
  summary: string;
  outline: string;
  description: string;
  tags: string[];
  createTime: Date;
  updatedTime?: Date;
  pubDate: Date;
  updatedDate?: Date;
  cover: string;
  coverMode: CoverMode;
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
  projectStage: "completed" | "in-progress" | "planned";
  priority: number;
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
    const tags = normalizeTagList(value.map((tag) => String(tag || "")));
    if (tags.length) return [...new Set(tags)];
  }
  return [];
}

function buildCodePermalink(entry: ArticleEntry, code: string): string {
  if (entry.collection === "tutorial") {
    if (isTutorialReadmeEntryId(entry.id)) {
      const routeSeriesKey = toSeriesRouteKey(deriveTutorialSeries(entry));
      if (routeSeriesKey) return buildTutorialSeriesPermalink(deriveTutorialSeries(entry));
    }
    return buildCollectionCodePermalink("tutorial", code);
  }

  return buildCollectionCodePermalink(entry.collection, code);
}

function normalizeCoverMode(value: unknown): CoverMode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "left" || normalized === "right" || normalized === "top" || normalized === "none") {
    return normalized;
  }
  return undefined;
}

function deriveTutorialSeries(entry: ArticleEntry): string {
  if (entry.collection !== "tutorial") return "";
  const raw = String(entry.id || "").replace(/\\/g, "/");
  const first = raw.split("/").find((segment) => segment && segment !== ".");
  return first ? first.trim() : "";
}

function deriveTutorialOrder(entry: ArticleEntry): number | undefined {
  if (entry.collection !== "tutorial") return undefined;
  const raw = String(entry.id || "").replace(/\\/g, "/");
  const last = raw.split("/").pop() || "";
  const matched = last.match(/^(\d{1,4})[-_]/);
  if (!matched) return undefined;
  const value = Number(matched[1]);
  return Number.isFinite(value) ? value : undefined;
}

export function resolveArticleMeta(entry: ArticleEntry): ResolvedArticleMeta {
  const cached = articleMetaCache.get(entry);
  if (cached) return cached;

  const defaults: ArticleDefaults = siteConfig.articleMeta.defaults;
  const code = resolveEntryCode(entry);
  const overrideByCode = (siteConfig.articleMeta.overridesByCode?.[code] ?? {}) as ArticleOverride;
  const overrideBySourcePath = (siteConfig.articleMeta.overridesBySourcePath?.[resolveSourceOverrideKey(entry)] ??
    {}) as ArticleOverride;
  const override = {
    ...overrideByCode,
    ...overrideBySourcePath
  } satisfies ArticleOverride;

  const title = resolveDerivedTitle(entry);
  const derivedCreateTime = resolveDerivedCreateTimeText(entry);
  const derivedTags = resolveDerivedTags(entry.data.tags);

  const summary = pickText(override.summary, entry.data.summary, defaults.summary);
  const outline = pickText(override.outline, (entry.data as { outline?: string }).outline, defaults.outline);
  const description = pickText(override.description, summary, defaults.description, title);
  const tags = normalizeTags(override.tags, entry.data.tags, derivedTags, defaults.tags);

  const createTime = pickDate(
    override.createTime,
    entry.data.createTime,
    derivedCreateTime,
    defaults.createTime
  ) ?? new Date("2026-01-01T00:00:00.000Z");
  const updatedTime = pickDate(override.updatedTime, defaults.updatedTime);
  const rawCover = pickText(override.cover, entry.data.cover, defaults.cover);
  const coverMode =
    normalizeCoverMode((entry.data as { coverMode?: string; coverPosition?: string }).coverMode) ??
    normalizeCoverMode((entry.data as { coverMode?: string; coverPosition?: string }).coverPosition) ??
    "right";
  const series = pickText(
    override.series,
    (entry.data as { series?: string }).series,
    deriveTutorialSeries(entry),
    defaults.series
  );
  const order = pickNumber(
    defaults.order,
    override.order,
    (entry.data as { order?: number }).order,
    deriveTutorialOrder(entry)
  );
  const permalink = buildCodePermalink(entry, code);
  const projectStage = pickText(override.projectStage, defaults.projectStage) as "completed" | "in-progress" | "planned";
  const stageFallbackCover =
    entry.collection === "projects"
      ? pickText(
          siteConfig.articleMeta.projectCoverFallbackByStage?.[projectStage as keyof typeof siteConfig.articleMeta.projectCoverFallbackByStage]
        )
      : "";
  const cover = rawCover || stageFallbackCover;
  const showCover =
    entry.collection === "projects"
      ? pickBoolean(override.showCover, Boolean(cover), defaults.showCover)
      : pickBoolean(override.showCover, defaults.showCover);

  const resolved: ResolvedArticleMeta = {
    title,
    code,
    permalink,
    summary,
    outline,
    description,
    tags,
    createTime,
    updatedTime,
    pubDate: createTime,
    updatedDate: updatedTime,
    cover,
    coverMode,
    showCover,
    draft: pickBoolean(override.draft, defaults.draft),
    encrypted: pickBoolean(override.encrypted, defaults.encrypted),
    encryptedFile: pickText(override.encryptedFile, defaults.encryptedFile),
    passwordHint: pickText(override.passwordHint, defaults.passwordHint),
    pinned: pickBoolean(override.pinned, defaults.pinned),
    series,
    order,
    projectType: pickText(override.projectType, defaults.projectType),
    repoUrl: pickText(override.repoUrl, defaults.repoUrl),
    docUrl: pickText(override.docUrl, defaults.docUrl),
    demoUrl: pickText(override.demoUrl, defaults.demoUrl),
    featured: pickBoolean(override.featured, defaults.featured),
    weight: pickNumber(defaults.weight, override.weight),
    projectStage,
    priority: pickNumber(defaults.priority, override.priority)
  };

  articleMetaCache.set(entry, resolved);
  return resolved;
}
