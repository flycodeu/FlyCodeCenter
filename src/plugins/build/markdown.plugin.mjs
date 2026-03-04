import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { remarkMarkdownInclude } from "../markdown/build/remark-include.ts";
import { remarkNormalizeCodeLang } from "../markdown/build/remark-normalize-code-lang.ts";
import { remarkExtendedBuild } from "../markdown/build/remark-extended-build.mjs";
import { rehypeImageEnhance } from "../markdown/build/rehype-image-enhance.ts";

export const markdownBuildPlugin = {
  id: "markdown",
  setup(siteConfig) {
    const remarkPlugins = [remarkNormalizeCodeLang];
    const rehypePlugins = [];

    if (siteConfig.markdown?.include?.enable) {
      remarkPlugins.push([
        remarkMarkdownInclude,
        {
          enabled: siteConfig.markdown.include.enable,
          root: "./src/content"
        }
      ]);
    }

    if (
      siteConfig.markdown?.extended?.enable &&
      (siteConfig.markdown?.extended?.parserMode ?? "build-time") === "build-time"
    ) {
      remarkPlugins.push([
        remarkExtendedBuild,
        {
          enableChartJs: siteConfig.markdown.extended.chartjs?.enable,
          enableTabs: siteConfig.markdown.extended.tabs?.enable,
          enableCodeGroup: siteConfig.markdown.extended.codeGroup?.enable,
          enableSteps: siteConfig.markdown.extended.steps?.enable,
          enableMark: siteConfig.markdown.extended.mark?.enable,
          enableIcon: siteConfig.markdown.extended.icon?.enable,
          enableCalloutTemplates: siteConfig.markdown.extended.calloutTemplates?.enable,
          chartHeight: siteConfig.markdown.extended.chartjs?.defaultHeight
        }
      ]);
    }

    if (siteConfig.markdown?.gfm?.enable) {
      remarkPlugins.push(remarkGfm);
    }

    if (siteConfig.markdown?.math?.enable) {
      remarkPlugins.push(remarkMath);
      rehypePlugins.push(rehypeKatex);
    }

    if (
      siteConfig.markdown?.image?.figure ||
      siteConfig.markdown?.image?.lazyload ||
      siteConfig.markdown?.image?.mark ||
      siteConfig.markdown?.image?.size
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

    return { remarkPlugins, rehypePlugins };
  }
};
