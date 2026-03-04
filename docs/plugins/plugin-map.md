# 插件功能地图

目标：快速定位“要改哪个功能，改哪个目录”。

## 一、构建期插件（Build-Time）

## `src/plugins/build/integrations.plugin.mjs`

- 负责：`mdx` / `partytown` / `sitemap` 集成装配
- 适用：新增或关闭 Astro integration

## `src/plugins/build/markdown.plugin.mjs`

- 负责：remark/rehype 链路装配
- 管理能力：
  - include
  - extended markdown
  - gfm
  - math + katex
  - image enhance

## `src/plugins/build/code-highlight.plugin.mjs`

- 负责：代码高亮 provider 装配（expressive / shiki / prism / rehype-pretty-code）
- 依赖：`src/plugins/code-highlight/resolve-config.ts`

## `src/plugins/core/build-pipeline.mjs`

- 负责：聚合所有 build 插件输出，供 `astro.config.mjs` 使用

## 二、Markdown 语法插件

## `src/plugins/markdown/build/*`

- `remark-include.ts`：Markdown include 语法
- `remark-normalize-code-lang.ts`：代码块语言标准化
- `remark-extended-build.ts(.mjs)`：tabs / steps / chartjs / demo / shortcode 等扩展解析
- `rehype-image-enhance.ts`：图片增强（figure/lazyload/size/mark）

## 三、文章页运行时插件（Article Runtime）

## `src/plugins/runtime/article/index.js`

- 负责：文章页全部运行时增强
- 主要能力：
  - anti-crawl
  - Mermaid / Draw.io / ECharts / Chart.js
  - 代码块头部、语言标记、复制按钮、行号增强
  - 代码块底部折叠图标（展开/收起）
  - 数学公式复制
  - Tabs 交互
  - Iconify 行内图标加载
  - 阅读统计上报
  - 阅读历史写入

## 四、样式层

## `src/styles/global.css`

- 负责：代码块容器、复制按钮、diagram 容器、md-tabs、md-steps、mdx-shortcode 样式

## 五、快速索引

- 改代码块复制文案：`src/plugins/runtime/article/index.js`
- 改 tabs 生成规则：`src/plugins/markdown/build/remark-extended-build.ts`
- 改 chartjs 语法解析：`src/plugins/markdown/build/remark-extended-build.ts`
- 改 demo 短代码解析：`src/plugins/markdown/build/remark-extended-build.ts`
- 改 chartjs 运行时渲染：`src/plugins/runtime/article/index.js`
- 改高亮 provider 默认值：`src/site.config.ts` -> `codeHighlight.provider`

## 六、质量门禁

- 脚本：`scripts/quality-guard.mjs`
- 入口：`npm run guard:quality`
- 构建链路：`npm run build` 会先执行 quality guard，再执行 frontmatter lint
