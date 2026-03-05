import { getCollection, type CollectionEntry } from "astro:content";
import siteConfig from "@/site.config";
import {
  isPublished,
  matchesInclude,
  sortByDateDesc,
  sortBlogWithPin,
  sortTutorialByOrder,
  toTagMap,
  type AnyEntry,
  type PostEntry
} from "@/utils/content";
import { resolveArticleMeta } from "@/utils/article-meta";
import { stripSlashes } from "@/utils/url";

export async function fetchBlogEntries(): Promise<CollectionEntry<"blog">[]> {
  const all = await getCollection("blog", (entry) => isPublished(entry));
  const filtered = all.filter((entry) => matchesInclude(entry.id));
  return sortBlogWithPin(filtered);
}

export async function fetchTutorialEntries(): Promise<CollectionEntry<"tutorial">[]> {
  const all = await getCollection("tutorial", (entry) => isPublished(entry));
  return [...all].sort((a, b) => resolveArticleMeta(b).createTime.getTime() - resolveArticleMeta(a).createTime.getTime());
}

type TutorialsHomeVisibilityConfig = {
  seriesMeta?: Record<string, { showOnHome?: boolean }>;
};

function canTutorialShowOnHome(entry: CollectionEntry<"tutorial">): boolean {
  const tutorialsConfig = (siteConfig.pages.tutorials as TutorialsHomeVisibilityConfig | undefined) ?? {};
  const seriesMeta = tutorialsConfig.seriesMeta ?? {};
  const rawSeries = String(resolveArticleMeta(entry).series || "").trim();
  const normalizedSeries = normalizeSeriesKey(rawSeries);
  if (!rawSeries && !normalizedSeries) return false;

  return Boolean(seriesMeta[rawSeries]?.showOnHome ?? seriesMeta[normalizedSeries]?.showOnHome);
}

export async function fetchHomeVisibleTutorialEntries(): Promise<CollectionEntry<"tutorial">[]> {
  const all = await fetchTutorialEntries();
  return all.filter((entry) => canTutorialShowOnHome(entry));
}

export async function fetchSitesEntries(): Promise<CollectionEntry<"sites">[]> {
  const all = await getCollection("sites", (entry) => isPublished(entry));
  return [...all].sort((a, b) => {
    if (a.data.order !== b.data.order) return a.data.order - b.data.order;
    const featuredDelta = Number(b.data.featured) - Number(a.data.featured);
    if (featuredDelta !== 0) return featuredDelta;
    if (a.data.weight !== b.data.weight) return b.data.weight - a.data.weight;
    return b.data.pubDate.getTime() - a.data.pubDate.getTime();
  });
}

export async function fetchReadingEntries(): Promise<CollectionEntry<"reading">[]> {
  const all = await getCollection("reading", (entry) => isPublished(entry));
  return [...all].sort((a, b) => {
    const featuredDelta = Number(b.data.featured) - Number(a.data.featured);
    if (featuredDelta !== 0) return featuredDelta;
    if (a.data.rating !== b.data.rating) return b.data.rating - a.data.rating;
    return b.data.pubDate.getTime() - a.data.pubDate.getTime();
  });
}

export function normalizeSeriesKey(series: string): string {
  return String(series || "").trim().toLowerCase();
}

export function resolveTutorialSlug(entry: CollectionEntry<"tutorial">): string {
  const meta = resolveArticleMeta(entry);
  const prefix = stripSlashes(siteConfig.articlePrefix || "/article");
  const normalized = stripSlashes(meta.permalink);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[0] === prefix && parts[1]) {
    return parts[1];
  }
  return meta.code;
}

export async function fetchTutorialSeries(series: string): Promise<CollectionEntry<"tutorial">[]> {
  const all = await fetchTutorialEntries();
  const normalized = normalizeSeriesKey(series);
  const target = all.filter((entry) => resolveArticleMeta(entry).series.trim().toLowerCase() === normalized);
  return sortTutorialByOrder(target);
}

export async function fetchTutorialSeriesEntries(series: string): Promise<CollectionEntry<"tutorial">[]> {
  return fetchTutorialSeries(series);
}

export async function findTutorialEntryBySeriesSlug(series: string, slug: string): Promise<CollectionEntry<"tutorial"> | null> {
  const normalizedSeries = normalizeSeriesKey(series);
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSeries || !normalizedSlug) return null;

  const entries = await fetchTutorialSeriesEntries(normalizedSeries);
  for (const entry of entries) {
    if (resolveTutorialSlug(entry).toLowerCase() === normalizedSlug) {
      return entry;
    }
  }
  return null;
}

export async function fetchProjectEntries(): Promise<CollectionEntry<"projects">[]> {
  const all = await getCollection("projects", (entry) => isPublished(entry));
  return [...all].sort((a, b) => {
    const metaA = resolveArticleMeta(a);
    const metaB = resolveArticleMeta(b);
    const featuredDelta = Number(metaB.featured) - Number(metaA.featured);
    if (featuredDelta !== 0) return featuredDelta;
    if (metaA.weight !== metaB.weight) return metaB.weight - metaA.weight;
    return metaB.createTime.getTime() - metaA.createTime.getTime();
  });
}

export async function fetchAllEntries(): Promise<PostEntry[]> {
  const [blog, tutorial] = await Promise.all([fetchBlogEntries(), fetchTutorialEntries()]);
  return sortByDateDesc([...blog, ...tutorial]);
}

export async function fetchHomeFeedEntries(): Promise<PostEntry[]> {
  const [blog, tutorial] = await Promise.all([fetchBlogEntries(), fetchHomeVisibleTutorialEntries()]);
  return sortByDateDesc([...blog, ...tutorial]);
}

export async function fetchAllContentEntries(): Promise<AnyEntry[]> {
  const [blog, tutorial, projects, sites, reading] = await Promise.all([
    fetchBlogEntries(),
    fetchTutorialEntries(),
    fetchProjectEntries(),
    fetchSitesEntries(),
    fetchReadingEntries()
  ]);
  return sortByDateDesc([...blog, ...tutorial, ...projects, ...sites, ...reading]);
}

export function makeTagItems(entries: AnyEntry[]) {
  return [...toTagMap(entries).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      href: `/tags/${encodeURIComponent(name)}`
    }));
}

export async function fetchDomainEntries(domain: "blog" | "tutorial" | "projects" | "sites" | "reading") {
  switch (domain) {
    case "blog":
      return fetchBlogEntries();
    case "tutorial":
      return fetchTutorialEntries();
    case "projects":
      return fetchProjectEntries();
    case "sites":
      return fetchSitesEntries();
    case "reading":
      return fetchReadingEntries();
    default:
      return [];
  }
}
