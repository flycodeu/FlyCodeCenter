# Build Plugins

These plugins are aggregated by `src/plugins/core/build-pipeline.mjs` and used
by `astro.config.mjs`.

Files:

- `integrations.plugin.mjs`: MDX / Partytown / Sitemap integrations
- `markdown.plugin.mjs`: remark/rehype markdown pipeline
  - syntax modules live in `src/plugins/markdown/build/*`
- `code-highlight.plugin.mjs`: syntax highlight provider pipeline
  - provider resolver lives in `src/plugins/code-highlight/resolve-config.ts`
- `index.mjs`: plugin registry
