import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";

export const integrationsBuildPlugin = {
  id: "integrations",
  setup(siteConfig) {
    const isProd = process.env.NODE_ENV === "production";
    const isFastDev = process.env.FLY_FAST_DEV_ACTIVE === "1";
    /** @type {unknown[]} */
    const integrations = [mdx()];
    if (siteConfig.performance?.partytown?.enable !== false && !isFastDev) {
      integrations.push(partytown());
    }
    if (siteConfig.seo?.sitemap?.enable && isProd) {
      integrations.push(sitemap());
    }
    return { integrations };
  }
};
