---
title: "环境变量与发布排错：最终清单"
createTime: "2026/03/05 15:40:00"
code: "sg0121"
permalink: "/article/sg0121/"
summary: "汇总部署后最常见问题，提供可复用的环境变量模板与发布前检查流程。"
series: "system-guide"
order: 21
tags:
  - "tutorial"
  - "system-guide"
  - "ops"
  - "checklist"
cover: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- 发布前必须检查的关键项。
- 环境变量管理的实践方式。
- 常见线上故障的快速定位路径。

## 环境变量模板（示意）
```env
# giscus
PUBLIC_GISCUS_REPO=owner/repo
PUBLIC_GISCUS_REPO_ID=...
PUBLIC_GISCUS_CATEGORY=General
PUBLIC_GISCUS_CATEGORY_ID=...

# utterances
PUBLIC_UTTERANCES_REPO=owner/repo
PUBLIC_UTTERANCES_ISSUE_TERM=pathname

# algolia (可选)
PUBLIC_ALGOLIA_APP_ID=
PUBLIC_ALGOLIA_API_KEY=
PUBLIC_ALGOLIA_INDEX_NAME=
```

## 发布前检查
1. `npm run build` 本地通过。
2. 关键页面手动验收（首页/教程/文章/关于）。
3. 评论与搜索可用。
4. 主题切换、代码高亮、图表渲染正常。

## 故障定位顺序
1. 浏览器 Console
2. Network 请求
3. Vercel Build Logs
4. 配置文件与环境变量对照

## 常见问题
- 部分页面正常、部分失败：重点检查路由参数与 frontmatter 字段。
- 本地正常、线上异常：重点检查环境变量分环境配置。

## 系列总结
你现在已经具备完整的系统配置、内容组织、能力展示、部署与排错闭环。
建议后续每次新增能力都按“开关 -> 示例 -> 验证 -> 排错”四步写入新教程。
