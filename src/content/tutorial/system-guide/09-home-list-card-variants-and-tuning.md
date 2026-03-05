---
title: "首页与列表卡片联动：模式、密度与可读性调优"
createTime: "2026/03/05 14:04:00"
code: "sg0109"
permalink: "/article/sg0109/"
summary: "将卡片策略应用到首页与分页，建立统一的信息层级与视觉节奏。"
series: "system-guide"
order: 9
tags:
  - "tutorial"
  - "system-guide"
  - "home"
  - "card"
cover: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- 首页 Feed 与博客列表的卡片策略如何统一。
- 卡片信息密度与可读性的平衡方法。

## 核心配置
```ts
home: { feed: { mode: "page", pageSize: 10 } },
blog: {
  pagination: { mode: "page", pageSize: 10 },
  listCard: { titleLines: 2, summaryLines: 3, tagsMax: 3 }
}
```

## 调优步骤
1. 先固定卡片宽高比例，避免跳动。
2. 再限制标题和摘要行数。
3. 最后调整 `pageSize` 与分页按钮密度。

## 效果验证
- 首页和 `/blog` 的卡片阅读节奏一致。
- 不会出现摘要过长导致卡片高度失衡。

## 常见问题与排查
- 页面抖动：检查图片尺寸和懒加载策略。
- 信息过密：降低 `tagsMax`、`summaryLines`。

## 下一篇预告
下一篇讲字体系统和字体预设切换。
