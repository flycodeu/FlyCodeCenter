import type { CollectionEntry } from "astro:content";
import siteConfig from "@/site.config";
import { resolveArticleMeta } from "@/utils/article-meta";

type TutorialEntry = CollectionEntry<"tutorial">;

export interface TutorialSeriesBucket {
  key: string;
  label: string;
  description: string;
  category: string;
  cover: string;
  icon: string;
  order: number;
  showOnHome: boolean;
  entries: TutorialEntry[];
  readmeEntry?: TutorialEntry;
  latestAt: number;
}

type TutorialSeriesFrontmatter = {
  title?: string;
  summary?: string;
  description?: string;
  category?: string;
  cover?: string;
  icon?: string;
  order?: number;
  showOnHome?: boolean;
};

type LegacyTutorialMeta = {
  label?: string;
  description?: string;
  category?: string;
  cover?: string;
  icon?: string;
  order?: number;
  showOnHome?: boolean;
};

type LegacyTutorialsConfig = {
  seriesMeta?: Record<string, LegacyTutorialMeta>;
  seriesLabels?: Record<string, string>;
};

function pickText(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeEntryId(entryId: string): string {
  return String(entryId || "").replace(/\\/g, "/").trim();
}

function getEntrySegments(entryId: string): string[] {
  return normalizeEntryId(entryId).split("/").filter(Boolean);
}

function getEntryStem(entryId: string): string {
  const segments = getEntrySegments(entryId);
  const last = segments.at(-1) || "";
  return last.replace(/\.(md|mdx)$/i, "").trim();
}

export function normalizeSeriesKey(series: string): string {
  return String(series || "").trim();
}

export function resolveSeriesKeyFromTutorialEntry(entry: TutorialEntry): string {
  const filePath = String((entry as { filePath?: string }).filePath || "").replace(/\\/g, "/");
  if (filePath) {
    const match =
      filePath.match(/(?:^|\/)src\/content\/tutorial\/([^/]+)/i) ||
      filePath.match(/(?:^|\/)content\/tutorial\/([^/]+)/i);
    if (match?.[1]) {
      const key = normalizeSeriesKey(match[1]);
      if (key) return key;
    }
  }

  const segments = getEntrySegments(entry.id);
  return normalizeSeriesKey(segments[0] || "");
}

function prettifySeriesKey(key: string): string {
  const raw = normalizeSeriesKey(key);
  if (!raw) return "Uncategorized Tutorials";
  const normalized = raw.replace(/[-_]+/g, " ").trim();
  if (/^[a-z0-9 +#]+$/i.test(normalized)) {
    return normalized.replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }
  return normalized;
}

function resolveLegacySeriesConfig(key: string) {
  const tutorialsConfig = (siteConfig.pages.tutorials as LegacyTutorialsConfig | undefined) ?? {};
  const seriesMeta = tutorialsConfig.seriesMeta ?? {};
  const seriesLabels = tutorialsConfig.seriesLabels ?? {};
  const legacyKey = key.toLowerCase();
  const meta = seriesMeta[key] ?? seriesMeta[legacyKey] ?? {};

  return {
    label: pickText(meta.label, seriesLabels[key], seriesLabels[legacyKey], prettifySeriesKey(key)),
    description: pickText(meta.description),
    category: pickText(meta.category),
    cover: pickText(meta.cover),
    icon: pickText(meta.icon),
    order: typeof meta.order === "number" && Number.isFinite(meta.order) ? meta.order : Number.MAX_SAFE_INTEGER,
    showOnHome: typeof meta.showOnHome === "boolean" ? meta.showOnHome : false
  };
}

export function isTutorialReadmeEntry(entry: TutorialEntry): boolean {
  return /^readme$/i.test(getEntryStem(entry.id));
}

export function resolveTutorialSlug(entry: TutorialEntry): string {
  const stem = getEntryStem(entry.id);
  if (/^readme$/i.test(stem)) return "index";
  return stem || resolveArticleMeta(entry).code;
}

function sortByArticleOrder(entries: TutorialEntry[]): TutorialEntry[] {
  return [...entries].sort((a, b) => {
    const metaA = resolveArticleMeta(a);
    const metaB = resolveArticleMeta(b);
    if (metaA.order !== metaB.order) return metaA.order - metaB.order;
    return metaA.createTime.getTime() - metaB.createTime.getTime();
  });
}

function sortEntriesInSeries(entries: TutorialEntry[]): TutorialEntry[] {
  const readmes = entries.filter((entry) => isTutorialReadmeEntry(entry));
  const others = entries.filter((entry) => !isTutorialReadmeEntry(entry));
  return [...sortByArticleOrder(readmes), ...sortByArticleOrder(others)];
}

function resolveSeriesMetaFromReadme(readme: TutorialEntry) {
  const data = (readme.data ?? {}) as TutorialSeriesFrontmatter;
  const article = resolveArticleMeta(readme);
  return {
    label: pickText(data.title),
    description: pickText(data.description, data.summary, article.summary),
    category: pickText(data.category),
    cover: pickText(data.cover, article.cover),
    icon: pickText(data.icon),
    order: typeof data.order === "number" && Number.isFinite(data.order) ? data.order : undefined,
    showOnHome: typeof data.showOnHome === "boolean" ? data.showOnHome : undefined
  };
}

export function buildTutorialSeriesBuckets(entries: TutorialEntry[]): Map<string, TutorialSeriesBucket> {
  const map = new Map<string, TutorialSeriesBucket>();

  for (const entry of entries) {
    const meta = resolveArticleMeta(entry);
    const key = normalizeSeriesKey(resolveSeriesKeyFromTutorialEntry(entry) || meta.series || "uncategorized") || "uncategorized";

    if (!map.has(key)) {
      const legacy = resolveLegacySeriesConfig(key);
      map.set(key, {
        key,
        label: legacy.label,
        description: legacy.description,
        category: legacy.category,
        cover: legacy.cover,
        icon: legacy.icon,
        order: legacy.order,
        showOnHome: legacy.showOnHome,
        entries: [],
        latestAt: 0
      });
    }

    const bucket = map.get(key)!;
    bucket.entries.push(entry);
    bucket.latestAt = Math.max(bucket.latestAt, meta.createTime.getTime());
    if (!bucket.cover) {
      bucket.cover = String(meta.cover || "").trim();
    }
    if (isTutorialReadmeEntry(entry) && !bucket.readmeEntry) {
      bucket.readmeEntry = entry;
    }
  }

  for (const bucket of map.values()) {
    bucket.entries = sortEntriesInSeries(bucket.entries);
    if (!bucket.readmeEntry) continue;

    const readmeMeta = resolveSeriesMetaFromReadme(bucket.readmeEntry);
    if (readmeMeta.label) bucket.label = readmeMeta.label;
    if (readmeMeta.description) bucket.description = readmeMeta.description;
    if (readmeMeta.category) bucket.category = readmeMeta.category;
    if (readmeMeta.icon) bucket.icon = readmeMeta.icon;
    if (readmeMeta.order !== undefined) bucket.order = readmeMeta.order;
    if (readmeMeta.cover) bucket.cover = readmeMeta.cover;
    if (readmeMeta.showOnHome !== undefined) bucket.showOnHome = readmeMeta.showOnHome;
  }

  return map;
}
