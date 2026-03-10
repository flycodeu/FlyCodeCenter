---
title: 搜索与性能：构建索引、按需加载与质量守卫
createTime: '2026/03/05 12:58:50'
code: talah2cgx
permalink: /article/talah2cgx/
summary: 掌握 pagefind/minisearch 配置与构建链路中的性能关键点。
series: system-guide
order: 19
tags:
  - tutorial
  - system-guide
  - search
  - performance
cover: https://images.unsplash.com/photo-1556155092-8707de31f9c4?auto=format&fit=crop&w=1600&q=80
---

## 你将学到什么
- 搜索 provider 的差异。
- 构建流程中质量守卫、索引生成与性能优化点。

## 配置示例
```ts
search: {
  provider: "pagefind",
  runtimeFallback: "minisearch",
  topK: 8,
  fuzzy: 0.22
}
```

## 构建链路
```bash
npm run guard:quality
npm run lint:frontmatter
npm run build
```

## 性能建议
1. 评论与搜索按需加载。
2. 图表脚本按能力开关注入。
3. 避免超大封面图直出。

## 效果验证
- 构建后 `dist/pagefind` 存在索引文件。
- 搜索弹窗可正确返回文章。

## 常见问题与排查
- 搜索无结果：检查索引是否生成、页面是否被收录。

## 下一篇预告
下一篇进入 GitHub + Vercel 部署全流程。
