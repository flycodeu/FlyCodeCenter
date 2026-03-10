import { toSeriesRouteKey } from "@/utils/tutorial-route";

export type ArticleDetailCollection = "blog" | "tutorial" | "projects";

const DETAIL_PREFIX_BY_COLLECTION: Record<ArticleDetailCollection, string> = {
  blog: "/blog",
  tutorial: "/tutorials",
  projects: "/projects"
};

export function getCollectionDetailPrefix(collection: ArticleDetailCollection): string {
  return DETAIL_PREFIX_BY_COLLECTION[collection];
}

export function buildCollectionCodePermalink(collection: ArticleDetailCollection, code: string): string {
  return `${getCollectionDetailPrefix(collection)}/${code}/`;
}

export function buildTutorialSeriesPermalink(seriesKey: string): string {
  return `/tutorials/${toSeriesRouteKey(seriesKey)}/`;
}
