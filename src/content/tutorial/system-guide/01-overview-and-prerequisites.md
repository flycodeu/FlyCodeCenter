---
title: 系统运行与配置教程：总览与学习路径
createTime: '2026/03/05 12:57:01'
code: t2krhis50
permalink: /article/t2krhis50/
summary: 先建立全局认知：项目如何运行、学习顺序是什么、每篇教程如何衔接。
series: system-guide
order: 1
tags:
  - tutorial
  - system-guide
  - overview
cover: https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80
---

## 你将学到什么
- 当前系统的运行结构（配置层、内容层、渲染层、部署层）。
- 为什么要按“先配置，再语法，再验证”的顺序学习。
- 整套教程如何从 0 走到可部署。

## 环境与前置条件
- Node.js 20+
- npm 10+
- Git + GitHub 账号
- 已拉取本项目代码并可本地运行

```bash
npm install
npm run dev
```

## 系统运行全景
1. `src/site.config.ts` 负责功能开关与站点行为。
2. `src/content/**` 负责文章与教程数据源。
3. `src/pages/**` 与 `src/layouts/**` 负责渲染与路由。
4. `npm run build` 做完整静态构建与索引生成。
5. GitHub + Vercel 负责发布上线。

## 学习建议
1. 先阅读配置相关章节（02~04）。
2. 再阅读具体能力章节（评论、主题、字体、代码块、Markdown 扩展）。
3. 最后完成部署与排错章节。

## 效果验证
- 访问 `/tutorials/system-guide`，确认能看到本系列目录。
- 阅读完本篇后，继续下一篇并观察左侧目录高亮变化。

## 常见问题与排查
- 如果系列没出现，先确认 frontmatter 中 `series: "system-guide"`。
- 如果排序不对，检查 `order` 是否连续。

## 下一篇预告
下一篇讲 `src/site.config.ts` 的全局配置入口与改动方法。
