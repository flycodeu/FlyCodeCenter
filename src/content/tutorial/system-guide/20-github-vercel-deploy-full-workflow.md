---
title: "GitHub + Vercel 部署全流程：从仓库到上线"
createTime: "2026/03/05 15:32:00"
code: "sg0120"
permalink: "/article/sg0120/"
summary: "围绕当前托管方式，完成从代码托管、环境变量到线上验证的完整部署。"
series: "system-guide"
order: 20
tags:
  - "tutorial"
  - "system-guide"
  - "deploy"
  - "vercel"
cover: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- 如何把当前项目稳定部署到 Vercel。
- 评论系统、搜索、主题相关变量如何在云端配置。

## 前置条件
- GitHub 仓库已准备好。
- Vercel 账号已绑定 GitHub。

## 部署步骤
1. 推送代码到 GitHub 主分支。
2. 在 Vercel `Add New Project` 导入仓库。
3. 设置 Build Command：

```bash
npm run build
```

4. 设置 Output Directory（若需）：`dist`
5. 在 Vercel 项目设置中配置环境变量（评论、搜索等）。
6. 点击 Deploy。

## 推荐环境变量分类
- 评论系统：giscus / utterances / waline / twikoo。
- 搜索系统：algolia（如启用）。
- 其他第三方服务密钥。

## 上线后验证清单
- 首页、博客页、教程页是否可访问。
- 评论是否可加载。
- 搜索是否可用。
- 主题切换是否正常。

## 常见问题与排查
- Build 失败：优先看 Vercel Build Logs。
- 评论不显示：核对 provider 与环境变量是否同环境（Preview/Production）。

## 下一篇预告
最后一篇给出环境变量模板与故障排查清单。
