---
title: "内容集合与路由机制：教程页面如何生成"
createTime: "2026/03/05 13:16:00"
code: "sg0103"
permalink: "/article/sg0103/"
summary: "从内容 schema 到 getStaticPaths，理解教程页是怎样被自动构建出来的。"
series: "system-guide"
order: 3
tags:
  - "tutorial"
  - "system-guide"
  - "routing"
cover: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- `content.config.ts` 如何定义 tutorial 集合。
- `/tutorials/[series]` 与 `/tutorials/[series]/[slug]` 的生成过程。
- frontmatter 字段与路由参数的关系。

## 环境与前置条件
- 理解 Markdown frontmatter 基础。

## 集合 schema
```ts
const tutorial = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/tutorial" }),
  schema: articleSchema
})
```

## 路由生成关键点
1. `fetchTutorialEntries()` 读取 tutorial 集合。
2. 按 `series` 分组并排序。
3. `getStaticPaths()` 生成静态路径。
4. `resolveTutorialSlug()` 解析 slug（优先 permalink/code）。

## frontmatter 最小集
```yaml
title: "..."
createTime: "2026/03/05 13:16:00"
code: "sg0103"
permalink: "/article/sg0103/"
series: "system-guide"
order: 3
```

## 效果验证
- 新增一篇教程后，运行 `npm run build`。
- 检查 `/tutorials/system-guide` 左侧目录是否出现新条目。

## 常见问题与排查
- 页面 404：检查 `series` 是否一致。
- 顺序异常：检查 `order` 是否为整数且无冲突。

## 下一篇预告
下一篇讲教程阅读页渲染链路（左侧列表、正文、右侧 TOC 的数据流）。
