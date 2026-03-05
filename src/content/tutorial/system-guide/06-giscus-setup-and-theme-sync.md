---
title: "Giscus 实战配置：从零可用到主题同步"
createTime: "2026/03/05 13:40:00"
code: "sg0106"
permalink: "/article/sg0106/"
summary: "按 GitHub + Vercel 场景配置 giscus，完成从仓库开关到页面评论可用的全流程。"
series: "system-guide"
order: 6
tags:
  - "tutorial"
  - "system-guide"
  - "comment"
  - "giscus"
cover: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- giscus 的前置条件与仓库设置。
- `site.config.ts` 的完整字段填写。
- 明暗主题同步与验证方式。

## 环境与前置条件
- 拥有 GitHub 仓库管理员权限。
- 仓库已启用 Discussions。

## 配置步骤
1. 在 GitHub Discussions 创建分类（如 `General`）。
2. 打开 giscus 配置页面生成参数。
3. 填入项目配置：

```ts
comment: {
  provider: "giscus",
  giscus: {
    repo: "owner/repo",
    repoId: "...",
    category: "General",
    categoryId: "...",
    mapping: "pathname"
  }
}
```

## 主题同步
- 确保 giscus light/dark 主题与站点主题切换方向一致。
- 切换站点主题后，评论 iframe 主题应同步更新。

## 效果验证
- 访问文章页，确认可加载评论框。
- 发表评论，检查 GitHub Discussions 是否创建对应讨论。

## 常见问题与排查
- 403/404：仓库名或 repoId 错误。
- 页面显示但不能评论：仓库讨论权限设置问题。

## 下一篇预告
下一篇讲 utterances 方案与多 provider 回退策略。
