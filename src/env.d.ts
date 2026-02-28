/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GISCUS_REPO?: string;
  readonly PUBLIC_GISCUS_REPO_ID?: string;
  readonly PUBLIC_GISCUS_CATEGORY?: string;
  readonly PUBLIC_GISCUS_CATEGORY_ID?: string;
  readonly PUBLIC_ALGOLIA_APP_ID?: string;
  readonly PUBLIC_ALGOLIA_API_KEY?: string;
  readonly PUBLIC_ALGOLIA_INDEX_NAME?: string;
  readonly PUBLIC_AI_API_BASE_URL?: string;
  readonly PUBLIC_AI_MODEL?: string;
  readonly PUBLIC_AI_WIDGET_SRC?: string;
  readonly PUBLIC_AI_WIDGET_IFRAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
