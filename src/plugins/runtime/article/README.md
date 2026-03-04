# Article Runtime Plugin

Entry: `src/plugins/runtime/article/index.js`

This plugin owns all post-page runtime enhancements that used to live in
`src/layouts/PostLayout.astro` inline script.

Main responsibilities:

- Anti-crawl lock
- Mermaid / Draw.io / ECharts runtime rendering
- Chart.js card rendering
- Code block toolbar and copy interactions
- KaTeX copy interaction
- Tabs interaction
- Inline icon runtime loading
- View stats sync
- Reading history persistence

If you need to change article runtime behavior, start here.
