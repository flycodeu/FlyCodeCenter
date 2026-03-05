---
title: "教程阅读页渲染链路：Sidebar、Content、TOC 如何协作"
createTime: "2026/03/05 13:24:00"
code: "sg0104"
permalink: "/article/sg0104/"
summary: "深入 TutorialReaderLayout 的数据流：目录高亮、正文渲染、TOC 同步的完整流程。"
series: "system-guide"
order: 4
tags:
  - "tutorial"
  - "system-guide"
  - "reader"
cover: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- TutorialReaderLayout 的三栏结构。
- `render(entry)` 到 `<Content />` 的渲染过程。
- 左侧目录高亮和右侧 TOC 的协作方式。

## 环境与前置条件
- 已了解前两篇中的路由与 frontmatter。

## 渲染链路
1. 页面组件读取 `currentEntry`。
2. `render(currentEntry)` 产出 `Content` 和 `headings`。
3. `TutorialSidebar` 接收同系列文章列表并高亮当前项。
4. `TOC` 组件根据 `headings` 展示大纲。

## 关键配置
```ts
pages: {
  tutorials: {
    reader: {
      sidebar: { width: 320, mobileDrawer: true },
      toc: { width: 280 },
      content: { maxWidth: 780 }
    }
  }
}
```

## 效果验证
- 切换不同教程文章，观察左侧高亮是否跟随。
- 滚动正文，观察右侧 TOC 是否同步。
- 移动端确认抽屉目录是否可打开。

## 常见问题与排查
- TOC 空白：文章内是否有 h2/h3 标题。
- 左侧目录不高亮：检查 `currentSlug` 与路由 slug 是否一致。

## 下一篇预告
下一篇进入评论系统总览，先搞清 provider 机制与选择策略。
