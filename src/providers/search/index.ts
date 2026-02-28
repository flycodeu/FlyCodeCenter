import siteConfig from "../../site.config";
import type { SearchEngine } from "./types";

export async function createSearchEngine(): Promise<SearchEngine> {
  switch (siteConfig.search.provider) {
    case "pagefind": {
      const { createPagefindEngine } = await import("./pagefind");
      return createPagefindEngine();
    }
    case "minisearch": {
      const { createMinisearchEngine } = await import("./minisearch");
      return createMinisearchEngine();
    }
    case "algolia": {
      const { createAlgoliaEngine } = await import("./algolia");
      return createAlgoliaEngine();
    }
    default:
      return {
        async search() {
          return [];
        }
      };
  }
}
