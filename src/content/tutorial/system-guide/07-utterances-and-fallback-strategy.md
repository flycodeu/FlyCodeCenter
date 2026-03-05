---
title: "Utterances 与回退策略：评论能力的第二条路径"
createTime: "2026/03/05 13:48:00"
code: "sg0107"
permalink: "/article/sg0107/"
summary: "掌握 utterances 的配置与主题联动，并建立评论系统的回退策略。"
series: "system-guide"
order: 7
tags:
  - "tutorial"
  - "system-guide"
  - "comment"
  - "utterances"
cover: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- utterances 的最小可用配置。
- 与 giscus 的差异。
- 生产环境回退策略（功能降级）。

## 配置示例
```ts
comment: {
  provider: "utterances",
  utterances: {
    repo: "owner/repo",
    issueTerm: "pathname",
    label: "comment",
    themeLight: "github-light",
    themeDark: "github-dark"
  }
}
```

## 回退策略建议
1. 首选 `giscus`。
2. 当 Discussions 不可用时切到 `utterances`。
3. 紧急场景可切 `off` 保证页面主流程可用。

## 效果验证
- 切换 provider 后重新构建并打开文章页。
- 评论创建后检查 GitHub Issues 是否同步生成。

## 常见问题与排查
- issue 未创建：检查仓库是否公开、应用权限是否正确。
- 主题不同步：检查 light/dark 主题字段。

## 下一篇预告
下一篇进入封面与列表卡片体系，讲清卡片显示策略和字段优先级。
