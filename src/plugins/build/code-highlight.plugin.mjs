import { resolveCodeHighlightConfig } from "../code-highlight/resolve-config.ts";

export const codeHighlightBuildPlugin = {
  id: "code-highlight",
  setup(siteConfig) {
    const highlightConfig = resolveCodeHighlightConfig(siteConfig);
    return {
      integrations: [...(highlightConfig.integrations ?? [])],
      rehypePlugins: [...(highlightConfig.extraRehypePlugins ?? [])],
      markdown: {
        syntaxHighlight: highlightConfig.syntaxHighlight,
        ...(highlightConfig.shikiConfig ? { shikiConfig: highlightConfig.shikiConfig } : {})
      }
    };
  }
};
