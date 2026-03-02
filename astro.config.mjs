import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import mdx from "@astrojs/mdx";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import siteConfig from "./src/site.config.ts";
import { remarkMarkdownInclude } from "./src/utils/markdown/remark-include.ts";
import { remarkNormalizeCodeLang } from "./src/utils/markdown/remark-normalize-code-lang.ts";
import { remarkExtendedBuild } from "./src/utils/markdown/remark-extended-build.mjs";
import { rehypeImageEnhance } from "./src/utils/markdown/rehype-image-enhance.ts";

const integrations = [mdx()];
if (siteConfig.seo.sitemap.enable) {
  integrations.push(sitemap());
}

const remarkPlugins = [];
remarkPlugins.push(remarkNormalizeCodeLang);
if (siteConfig.markdown.gfm.enable) {
  remarkPlugins.push(remarkGfm);
}
if (siteConfig.markdown.math.enable) {
  remarkPlugins.push(remarkMath);
}
if (siteConfig.markdown.include.enable) {
  remarkPlugins.push([
    remarkMarkdownInclude,
    {
      enabled: siteConfig.markdown.include.enable,
      root: "./src/content"
    }
  ]);
}
if (
  siteConfig.markdown.extended?.enable &&
  (siteConfig.markdown.extended?.parserMode ?? "build-time") === "build-time"
) {
  remarkPlugins.push([
    remarkExtendedBuild,
    {
      enableChartJs: siteConfig.markdown.extended.chartjs?.enable,
      enableTabs: siteConfig.markdown.extended.tabs?.enable,
      enableSteps: siteConfig.markdown.extended.steps?.enable,
      enableMark: siteConfig.markdown.extended.mark?.enable,
      enableIcon: siteConfig.markdown.extended.icon?.enable,
      chartHeight: siteConfig.markdown.extended.chartjs?.defaultHeight
    }
  ]);
}

const rehypePlugins = [];
if (siteConfig.markdown.math.enable) {
  rehypePlugins.push(rehypeKatex);
}
if (
  siteConfig.markdown.image.figure ||
  siteConfig.markdown.image.lazyload ||
  siteConfig.markdown.image.mark ||
  siteConfig.markdown.image.size
) {
  rehypePlugins.push([
    rehypeImageEnhance,
    {
      enableFigure: siteConfig.markdown.image.figure,
      lazyload: siteConfig.markdown.image.lazyload,
      enableMark: siteConfig.markdown.image.mark,
      enableSize: siteConfig.markdown.image.size
    }
  ]);
}

export default defineConfig({
  adapter: vercel(),
  output: "static",
  site: siteConfig.site.hostname,
  base: siteConfig.site.base,
  integrations,
  markdown: {
    syntaxHighlight: "prism",
    remarkPlugins,
    rehypePlugins
  },
  experimental: {
    contentIntellisense: true
  }
});
