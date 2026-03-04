import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import siteConfig from "./src/site.config.ts";
import { buildAstroPipeline } from "./src/plugins/core/build-pipeline.mjs";
import { buildPlugins } from "./src/plugins/build/index.mjs";

const pipeline = buildAstroPipeline(siteConfig, buildPlugins);

export default defineConfig({
  adapter: vercel(),
  output: "static",
  site: siteConfig.site.hostname,
  base: siteConfig.site.base,
  integrations: pipeline.integrations,
  markdown: pipeline.markdown,
  experimental: {
    contentIntellisense: true
  }
});
