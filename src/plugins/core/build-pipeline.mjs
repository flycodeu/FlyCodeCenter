/**
 * @typedef {{
 *  id: string;
 *  setup: (siteConfig: any) => {
 *    integrations?: unknown[];
 *    remarkPlugins?: unknown[];
 *    rehypePlugins?: unknown[];
 *    markdown?: {
 *      syntaxHighlight?: "prism" | "shiki" | false;
 *      shikiConfig?: Record<string, unknown>;
 *    };
 *  };
 * }} BuildPlugin
 */

/**
 * @param {any} siteConfig
 * @param {BuildPlugin[]} plugins
 */
export function buildAstroPipeline(siteConfig, plugins) {
  const integrations = [];
  const remarkPlugins = [];
  const rehypePlugins = [];
  /** @type {{ syntaxHighlight?: "prism" | "shiki" | false; shikiConfig?: Record<string, unknown> }} */
  const markdown = {};

  for (const plugin of plugins) {
    if (!plugin || typeof plugin.setup !== "function") continue;
    const output = plugin.setup(siteConfig) || {};
    if (Array.isArray(output.integrations) && output.integrations.length) {
      integrations.push(...output.integrations);
    }
    if (Array.isArray(output.remarkPlugins) && output.remarkPlugins.length) {
      remarkPlugins.push(...output.remarkPlugins);
    }
    if (Array.isArray(output.rehypePlugins) && output.rehypePlugins.length) {
      rehypePlugins.push(...output.rehypePlugins);
    }
    if (output.markdown && typeof output.markdown === "object") {
      Object.assign(markdown, output.markdown);
    }
  }

  return {
    integrations,
    markdown: {
      ...markdown,
      remarkPlugins,
      rehypePlugins
    }
  };
}
