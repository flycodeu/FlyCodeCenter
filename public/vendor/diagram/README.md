# Diagram Vendor Bundles

Place optional local diagram bundles here:

- `mermaid.esm.min.mjs`
- `echarts.esm.min.js`

When `src/site.config.ts` uses:

- `diagram.mermaid.source = "local"`
- `diagram.echarts.source = "local"`

the article runtime will load these files first.
If `diagram.fallbackToCdn = true`, runtime falls back to configured CDN URLs when local files are unavailable.
