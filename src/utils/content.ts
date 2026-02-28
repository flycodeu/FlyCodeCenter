import type { CollectionEntry } from "astro:content";
import micromatch from "micromatch";
import siteConfig from "@/site.config";
import { resolveEntryCode } from "@/utils/content-code";
import { stripSlashes, trimPath, withBase } from "@/utils/url";

export type PostEntry = CollectionEntry<"blog"> | CollectionEntry<"tutorial">;
export type ProjectEntry = CollectionEntry<"projects">;
export type AnyEntry = PostEntry | ProjectEntry | CollectionEntry<"sites"> | CollectionEntry<"reading">;

export function isPublished(entry: AnyEntry): boolean {
  return !entry.data.draft;
}

export function matchesInclude(entryId: string): boolean {
  const patterns = siteConfig.blog.include;
  if (!patterns.length) return true;
  return micromatch.isMatch(entryId, patterns);
}

export function getBlogEntryUrl(entry: CollectionEntry<"blog">): string {
  const prefix = stripSlashes(siteConfig.articlePrefix || "/article");
  const code = resolveEntryCode(entry);
  return trimPath(withBase(`/${prefix}/${code}`));
}

export function getTutorialEntryUrl(entry: CollectionEntry<"tutorial">): string {
  const prefix = stripSlashes(siteConfig.articlePrefix || "/article");
  const code = resolveEntryCode(entry);
  return trimPath(withBase(`/${prefix}/${code}`));
}

export function getProjectEntryUrl(entry: CollectionEntry<"projects">): string {
  const prefix = stripSlashes(siteConfig.articlePrefix || "/article");
  const code = resolveEntryCode(entry);
  return trimPath(withBase(`/${prefix}/${code}`));
}

export function toTagMap(entries: AnyEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.data.tags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return map;
}

export function sortByDateDesc<T extends AnyEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export function sortBlogWithPin(entries: CollectionEntry<"blog">[]): CollectionEntry<"blog">[] {
  const pinFirst = siteConfig.blog.sorting.pinFirst;
  if (!pinFirst) return sortByDateDesc(entries);
  return [...entries].sort((a, b) => {
    const pinA = a.data.pinned ? 1 : 0;
    const pinB = b.data.pinned ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    if (a.data.pinned && b.data.pinned && a.data.pinOrder !== b.data.pinOrder) {
      return a.data.pinOrder - b.data.pinOrder;
    }
    return b.data.pubDate.getTime() - a.data.pubDate.getTime();
  });
}

export function sortTutorialByOrder(entries: CollectionEntry<"tutorial">[]): CollectionEntry<"tutorial">[] {
  return [...entries].sort((a, b) => {
    if (a.data.order === b.data.order) {
      return a.data.pubDate.getTime() - b.data.pubDate.getTime();
    }
    return a.data.order - b.data.order;
  });
}

export function buildArchiveBuckets(entries: PostEntry[]): Map<string, PostEntry[]> {
  const map = new Map<string, PostEntry[]>();
  for (const entry of entries) {
    const key = `${entry.data.pubDate.getFullYear()}-${String(entry.data.pubDate.getMonth() + 1).padStart(2, "0")}`;
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return map;
}

export function buildYearBuckets(entries: PostEntry[]): Map<string, PostEntry[]> {
  const map = new Map<string, PostEntry[]>();
  for (const entry of entries) {
    const key = String(entry.data.pubDate.getFullYear());
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return map;
}

export function entryDomain(entry: AnyEntry): "blog" | "tutorial" | "projects" | "sites" | "reading" {
  return entry.collection;
}

export function getEntryLink(entry: AnyEntry): string {
  if (entry.collection === "blog") return getBlogEntryUrl(entry);
  if (entry.collection === "tutorial") return getTutorialEntryUrl(entry);
  if (entry.collection === "projects") return getProjectEntryUrl(entry);
  return entry.data.url;
}
