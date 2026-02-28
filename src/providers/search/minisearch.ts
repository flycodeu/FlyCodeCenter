import MiniSearch from "minisearch";
import siteConfig from "../../site.config";
import { cjkNgramTokens, makeSnippet } from "./shared";
import type { SearchEngine, SearchResult } from "./types";

interface MiniDoc {
  id: string;
  code?: string;
  domain?: string;
  title: string;
  url: string;
  description: string;
  content: string;
  headings?: string;
  tags?: string;
}

export async function createMinisearchEngine(): Promise<SearchEngine> {
  const response = await fetch(siteConfig.search.minisearch.indexPath, {
    cache: "force-cache"
  });

  if (!response.ok) {
    throw new Error(`Failed to load minisearch index: ${response.status}`);
  }

  const payload = (await response.json()) as { documents: MiniDoc[] };
  const docs = payload.documents ?? [];

  const miniSearch = new MiniSearch<MiniDoc>({
    fields: ["title", "description", "content", "tags", "headings", "code"],
    storeFields: ["title", "url", "description", "content", "domain", "code"],
    tokenize: (text) => cjkNgramTokens(text)
  });
  miniSearch.addAll(docs);

  return {
    async search(query: string): Promise<SearchResult[]> {
      const hits = miniSearch.search(query, {
        prefix: true,
        fuzzy: siteConfig.search.fuzzy,
        boost: siteConfig.search.minisearch.boost
      });

      return hits.slice(0, siteConfig.search.topK).map((item) => {
        const content = String(item.content ?? item.description ?? "");
        return {
          title: String(item.title ?? "Untitled"),
          url: String(item.url ?? "/"),
          snippet: makeSnippet(content, query),
          score: typeof item.score === "number" ? item.score : 0
        };
      });
    }
  };
}
