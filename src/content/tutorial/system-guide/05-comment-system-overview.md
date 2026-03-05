---
title: "评论系统总览：provider 机制与选型"
createTime: "2026/03/05 13:32:00"
code: "sg0105"
permalink: "/article/sg0105/"
summary: "从 off/giscus/utterances/waline/twikoo 统一视角理解评论系统配置和显示逻辑。"
series: "system-guide"
order: 5
tags:
  - "tutorial"
  - "system-guide"
  - "comment"
cover: "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- 评论 provider 的开关与渲染逻辑。
- 不同评论方案的适配场景。
- 如何快速判断“为什么评论没显示”。

## 配置入口
```ts
comment: {
  provider: "giscus", // off | giscus | utterances | waline | twikoo
}
```

## 选型建议
- GitHub 仓库型站点：优先 `giscus` 或 `utterances`。
- 自托管后端：可选 `waline` / `twikoo`。
- 临时关闭：`provider: "off"`。

## 渲染判断逻辑
1. provider 为 `off` -> 不渲染评论。
2. provider 已开启但配置缺失 -> 组件输出提示或空状态。
3. 配置完整 -> 文章底部显示评论区。

## 效果验证
- 打开任意文章页，确认评论区是否显示。
- 切换 provider 后，刷新页面检查实际渲染结果。

## 常见问题与排查
- 不显示：检查 provider 和必填字段。
- 主题不同步：检查 `themeSync` 或 provider 主题映射配置。

## 下一篇预告
下一篇详细讲 giscus 的完整配置、权限要求和主题同步。
