# Markdown Plugin Modules

`src/plugins/markdown/build/` contains all markdown build-time transforms used by
`src/plugins/build/markdown.plugin.mjs`.

Files:

- `remark-include.ts`: include markdown files by marker syntax.
- `remark-normalize-code-lang.ts`: normalize fenced code language aliases.
- `remark-extended-build.ts` / `.mjs`: extended markdown syntax parser.
- `rehype-image-enhance.ts`: figure/lazyload/size/image-mark enhancements.

If you need to add or adjust markdown syntax support, start in this directory.
