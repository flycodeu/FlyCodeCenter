import siteConfig from "../../site.config";
import type { SearchEngine } from "./types";

export async function createSearchEngine(): Promise<SearchEngine> {
  const fallback = (siteConfig.search as { runtimeFallback?: "off" | "minisearch" }).runtimeFallback ?? "off";
  const pagefindEnableInDev =
    (siteConfig.search as { pagefind?: { enableInDev?: boolean } }).pagefind?.enableInDev ?? false;
  const disablePagefindInDev = import.meta.env.DEV && !pagefindEnableInDev;
  try {
    switch (siteConfig.search.provider) {
      case "pagefind": {
        if (disablePagefindInDev) {
          const { createMinisearchEngine } = await import("./minisearch");
          return createMinisearchEngine();
        }
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
  } catch (error) {
    if (fallback === "minisearch") {
      const { createMinisearchEngine } = await import("./minisearch");
      return createMinisearchEngine();
    }
    throw error;
  }
}
