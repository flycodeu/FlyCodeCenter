import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";

export const integrationsBuildPlugin = {
  id: "integrations",
  setup(siteConfig) {
    /** @type {unknown[]} */
    const integrations = [mdx()];
    if (siteConfig.performance?.partytown?.enable !== false) {
      integrations.push(partytown());
    }
    if (siteConfig.seo?.sitemap?.enable) {
      integrations.push(sitemap());
    }
    return { integrations };
  }
};
