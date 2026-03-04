# 系统配置总览

`src/site.config.ts` 是系统唯一配置入口。  
规则是：先改配置，再到对应插件目录改实现。

## 配置总原则

1. 所有开关、默认值、展示策略都在 `src/site.config.ts`
2. 构建期能力在 `src/plugins/build/*` 与 `src/plugins/markdown/build/*`
3. 文章页运行时能力在 `src/plugins/runtime/article/index.js`

## 常用配置分区

## 站点基础

- 路径：`site.*`
- 作用：站点标题、描述、域名、favicon、head meta

## 主题与导航

- 路径：`theme.*`
- 作用：主题列表、导航、页脚、TOC、字体预设

## 文章与列表

- 路径：`article.*`、`blog.*`、`home.*`
- 作用：文章页间距、反爬设置、分页、卡片布局

## Markdown 能力

- 路径：`markdown.*`
- 作用：GFM、include、math、image 增强、扩展语法、复制开关
- 实现目录：
  - `src/plugins/build/markdown.plugin.mjs`
  - `src/plugins/markdown/build/*`

## 代码块高亮

- 路径：`codeHighlight.*`、`codeTheme.*`
- 作用：provider、语言白名单、行号、窗口头样式、主题色
- 实现目录：
  - `src/plugins/build/code-highlight.plugin.mjs`
  - `src/plugins/code-highlight/resolve-config.ts`

## 图形与图表

- 路径：`features.diagram.*`、`diagram.*`、`markdown.extended.chartjs.*`
- 作用：Mermaid / Draw.io / ECharts / Chart.js 开关与 bundle
- 实现目录：
  - `src/plugins/runtime/article/index.js`

## 搜索 / 评论 / 统计

- 路径：`search.*`、`comment.*`、`stats.*`
- 作用：搜索 provider、评论 provider、阅读统计接口

## 常见修改示例

## 1) 切换默认字体为像素字体

```ts
theme: {
  typography: {
    fontPresetDefault: "pixel"
  }
}
```

## 2) 切换默认字体为常规字体

```ts
theme: {
  typography: {
    fontPresetDefault: "regular"
  }
}
```

## 3) 关闭 Markdown 扩展语法

```ts
markdown: {
  extended: {
    enable: false
  }
}
```

## 4) 切换代码高亮 provider

```ts
codeHighlight: {
  provider: "prism" // expressive | shiki | prism | rehype-pretty-code
}
```

## 5) 关闭 Mermaid

```ts
features: {
  diagram: {
    mermaid: false
  }
}
```

## 配置生效链路

1. `src/site.config.ts` -> `astro.config.mjs`（构建期）
2. `src/site.config.ts` -> `src/layouts/PostLayout.astro` 的 `define:vars`（运行时注入）
3. 运行时功能统一在 `src/plugins/runtime/article/index.js` 执行
