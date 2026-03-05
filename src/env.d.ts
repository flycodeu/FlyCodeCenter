/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GISCUS_REPO?: string;
  readonly PUBLIC_GISCUS_REPO_ID?: string;
  readonly PUBLIC_GISCUS_CATEGORY?: string;
  readonly PUBLIC_GISCUS_CATEGORY_ID?: string;
  readonly PUBLIC_WALINE_SERVER?: string;
  readonly PUBLIC_TWIKOO_ENV_ID?: string;
  readonly PUBLIC_UTTERANCES_REPO?: string;
  readonly PUBLIC_UTTERANCES_ISSUE_TERM?: string;
  readonly PUBLIC_UTTERANCES_LABEL?: string;
  readonly PUBLIC_UTTERANCES_THEME_LIGHT?: string;
  readonly PUBLIC_UTTERANCES_THEME_DARK?: string;
  readonly PUBLIC_ALGOLIA_APP_ID?: string;
  readonly PUBLIC_ALGOLIA_API_KEY?: string;
  readonly PUBLIC_ALGOLIA_INDEX_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
