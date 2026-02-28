import { liteClient } from "algoliasearch/lite";
import siteConfig from "../../site.config";
import { makeSnippet } from "./shared";
import type { SearchEngine, SearchResult } from "./types";

export async function createAlgoliaEngine(): Promise<SearchEngine> {
  const { appId, apiKey, indexName } = siteConfig.search.algolia;
  if (!appId || !apiKey || !indexName) {
    throw new Error("Algolia 配置缺失，请检查 site.config.ts 或环境变量。");
  }

  const client = liteClient(appId, apiKey);

  return {
    async search(query: string): Promise<SearchResult[]> {
      const response: any = await client.search([
        {
          indexName,
          query,
          params: {
            hitsPerPage: siteConfig.search.topK
          }
        }
      ]);

      const hits = response?.results?.[0]?.hits ?? [];
      return hits.map((hit: any) => {
        const url = hit.url ?? hit.permalink ?? hit.path ?? "/";
        const title = hit.title ?? hit._highlightResult?.title?.value ?? "Untitled";
        const summary = hit.description ?? hit.content ?? "";
        return {
          title,
          url,
          snippet: makeSnippet(summary, query),
          score: Number(hit._rankingInfo?.nbTypos ?? 0)
        };
      });
    }
  };
}
