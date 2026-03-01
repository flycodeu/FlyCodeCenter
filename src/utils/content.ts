import type { CollectionEntry } from "astro:content";
import micromatch from "micromatch";
import siteConfig from "@/site.config";
import { resolveArticleMeta } from "@/utils/article-meta";
import { trimPath, withBase } from "@/utils/url";

export type PostEntry = CollectionEntry<"blog"> | CollectionEntry<"tutorial">;
export type ProjectEntry = CollectionEntry<"projects">;
export type AnyEntry = PostEntry | ProjectEntry | CollectionEntry<"sites"> | CollectionEntry<"reading">;

export function isPublished(entry: AnyEntry): boolean {
  if (entry.collection === "blog" || entry.collection === "tutorial" || entry.collection === "projects") {
    return !resolveArticleMeta(entry as CollectionEntry<"blog"> | CollectionEntry<"tutorial"> | CollectionEntry<"projects">).draft;
  }
  return !entry.data.draft;
}

export function matchesInclude(entryId: string): boolean {
  const patterns = siteConfig.blog.include;
  if (!patterns.length) return true;
  return micromatch.isMatch(entryId, patterns);
}

export function getBlogEntryUrl(entry: CollectionEntry<"blog">): string {
  const meta = resolveArticleMeta(entry);
  return trimPath(withBase(meta.permalink));
}

export function getTutorialEntryUrl(entry: CollectionEntry<"tutorial">): string {
  const meta = resolveArticleMeta(entry);
  return trimPath(withBase(meta.permalink));
}

export function getProjectEntryUrl(entry: CollectionEntry<"projects">): string {
  const meta = resolveArticleMeta(entry);
  return trimPath(withBase(meta.permalink));
}

export function toTagMap(entries: AnyEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const tags =
      entry.collection === "blog" || entry.collection === "tutorial" || entry.collection === "projects"
        ? resolveArticleMeta(
            entry as CollectionEntry<"blog"> | CollectionEntry<"tutorial"> | CollectionEntry<"projects">
          ).tags
        : (entry.data.tags ?? []);
    for (const tag of tags) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return map;
}

export function sortByDateDesc<T extends AnyEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const aTime =
      a.collection === "blog" || a.collection === "tutorial" || a.collection === "projects"
        ? resolveArticleMeta(
            a as CollectionEntry<"blog"> | CollectionEntry<"tutorial"> | CollectionEntry<"projects">
          ).createTime.getTime()
        : a.data.pubDate instanceof Date
          ? a.data.pubDate.getTime()
          : 0;
    const bTime =
      b.collection === "blog" || b.collection === "tutorial" || b.collection === "projects"
        ? resolveArticleMeta(
            b as CollectionEntry<"blog"> | CollectionEntry<"tutorial"> | CollectionEntry<"projects">
          ).createTime.getTime()
        : b.data.pubDate instanceof Date
          ? b.data.pubDate.getTime()
          : 0;
    return bTime - aTime;
  });
}

export function sortBlogWithPin(entries: CollectionEntry<"blog">[]): CollectionEntry<"blog">[] {
  const pinFirst = siteConfig.blog.sorting.pinFirst;
  if (!pinFirst) {
    return [...entries].sort((a, b) => resolveArticleMeta(b).createTime.getTime() - resolveArticleMeta(a).createTime.getTime());
  }
  return [...entries].sort((a, b) => {
    const metaA = resolveArticleMeta(a);
    const metaB = resolveArticleMeta(b);
    const pinA = metaA.pinned ? 1 : 0;
    const pinB = metaB.pinned ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    return metaB.createTime.getTime() - metaA.createTime.getTime();
  });
}

export function sortTutorialByOrder(entries: CollectionEntry<"tutorial">[]): CollectionEntry<"tutorial">[] {
  return [...entries].sort((a, b) => {
    const metaA = resolveArticleMeta(a);
    const metaB = resolveArticleMeta(b);
    if (metaA.order === metaB.order) {
      return metaA.createTime.getTime() - metaB.createTime.getTime();
    }
    return metaA.order - metaB.order;
  });
}

export function buildArchiveBuckets(entries: PostEntry[]): Map<string, PostEntry[]> {
  const map = new Map<string, PostEntry[]>();
  for (const entry of entries) {
    const meta = resolveArticleMeta(entry);
    const key = `${meta.createTime.getFullYear()}-${String(meta.createTime.getMonth() + 1).padStart(2, "0")}`;
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return map;
}

export function buildYearBuckets(entries: PostEntry[]): Map<string, PostEntry[]> {
  const map = new Map<string, PostEntry[]>();
  for (const entry of entries) {
    const meta = resolveArticleMeta(entry);
    const key = String(meta.createTime.getFullYear());
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
