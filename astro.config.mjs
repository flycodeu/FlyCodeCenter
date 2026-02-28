import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { transformerRenderWhitespace } from "@shikijs/transformers";
import { transformerTwoslash } from "@shikijs/twoslash";
import siteConfig from "./src/site.config.ts";
import { remarkMarkdownInclude } from "./src/utils/markdown/remark-include.ts";
import { rehypeImageEnhance } from "./src/utils/markdown/rehype-image-enhance.ts";

const integrations = [vercel()];
if (siteConfig.seo.sitemap.enable) {
  integrations.push(sitemap());
}

const shikiTransformers = [];
if (siteConfig.codeHighlight.showWhitespace) {
  shikiTransformers.push(transformerRenderWhitespace());
}
if (siteConfig.codeHighlight.twoslash) {
  shikiTransformers.push(transformerTwoslash());
}

const remarkPlugins = [];
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
  output: "static",
  site: siteConfig.site.hostname,
  base: siteConfig.site.base,
  integrations,
  markdown: {
    syntaxHighlight: "shiki",
    shikiConfig: {
      langs: siteConfig.codeHighlight.languages,
      theme: siteConfig.codeHighlight.theme,
      wrap: siteConfig.codeHighlight.lineNumbers || siteConfig.codeHighlight.showWhitespace,
      transformers: shikiTransformers
    },
    remarkPlugins,
    rehypePlugins
  },
  experimental: {
    contentIntellisense: true
  }
});
