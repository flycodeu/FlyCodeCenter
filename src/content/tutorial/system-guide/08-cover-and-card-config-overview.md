---
title: "封面与列表卡片：全局策略与单篇控制"
createTime: "2026/03/05 13:56:00"
code: "sg0108"
permalink: "/article/sg0108/"
summary: "讲清列表卡片封面策略、尺寸比例、单篇覆盖优先级和验证方法。"
series: "system-guide"
order: 8
tags:
  - "tutorial"
  - "system-guide"
  - "card"
  - "cover"
cover: "https://images.unsplash.com/photo-1483058712412-4245e9b90334?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- 列表卡片封面的全局配置。
- 单篇文章如何覆盖默认封面策略。
- 预览页与总览页的视觉一致性控制。

## 全局配置
```ts
blog: {
  listCard: {
    defaultCoverMode: "right", // right | left | top | none
    coverWidth: 224,
    coverHeight: 154,
    coverAspectRatio: "16 / 9"
  }
}
```

## 单篇 frontmatter
```yaml
cover: "https://images.unsplash.com/..."
coverMode: "top"
```

## 步骤
1. 先设置全局默认模式。
2. 在个别文章中设置 `coverMode` 覆盖默认值。
3. 打开 `/blog` 与 `/tutorials` 对比卡片展示。

## 效果验证
- `none` 时卡片无封面。
- `left/right/top` 时封面位置与尺寸符合预期。

## 常见问题与排查
- 封面不显示：检查图片 URL 是否可访问。
- 模式无变化：检查 `coverMode` 拼写是否在允许集合中。

## 下一篇预告
下一篇将把封面策略带入首页流与分页卡片，做整体视觉调优。
