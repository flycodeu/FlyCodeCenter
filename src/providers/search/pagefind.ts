import siteConfig from "../../site.config";
import { makeSnippet } from "./shared";
import type { SearchEngine, SearchResult } from "./types";

interface PagefindResultData {
  url: string;
  excerpt: string;
  meta?: {
    title?: string;
  };
}

export async function createPagefindEngine(): Promise<SearchEngine> {
  const mod = await import(/* @vite-ignore */ siteConfig.search.pagefind.bundlePath);
  const api = mod.default ?? mod;

  return {
    async search(query: string): Promise<SearchResult[]> {
      const raw = await api.search(query, { limit: siteConfig.search.topK });
      const list = await Promise.all(
        raw.results.map(async (item: any) => {
          const data: PagefindResultData = await item.data();
          return {
            title: data.meta?.title ?? "Untitled",
            url: data.url,
            snippet: makeSnippet(data.excerpt ?? "", query),
            score: 1
          };
        })
      );
      return list;
    }
  };
}
