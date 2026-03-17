# FlyCodeCenter Astro Blog

开源个人博客主题，基于 Astro 构建，静态优先、可插拔评论与搜索。
Open-source personal blog theme built with Astro: static-first, fast, and extensible.

[![Astro](https://img.shields.io/badge/Astro-5.17.1-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)
[![Demo](https://img.shields.io/badge/Demo-flycode.icu-0ea5e9)](https://www.flycode.icu)

## Overview / 项目简介

- 这是什么：一个开源的个人博客 Astro 自建主题，强调内容呈现与可维护性。
- What it is: an open-source Astro theme for personal blogs focused on content and DX.
- Demo: https://www.flycode.icu

## Features / 功能

- 静态优先 + 按需加载，页面响应快。
- 主题包与布局预设，支持多风格切换。
- 搜索支持 Pagefind / Minisearch，构建自动生成索引。
- 评论支持 Giscus / Waline / Twikoo。
- Mermaid / Draw.io / ECharts 等图表能力。
- Blog / Tutorial / Tags 等内容组织与页面体系。

## Quick Start / 快速开始

```bash
npm install
npm run dev
```

默认开发地址：`http://localhost:4321`

## Build & Preview / 构建与预览

```bash
npm run build
npm run preview
```

`build` 完成后会自动执行 `postbuild`：

1. 生成 `minisearch` 索引（`public/search/minisearch.json` 与 `dist/search/minisearch.json`）
2. 生成 `pagefind` 索引（`/pagefind/pagefind.js`）

## Deploy to Vercel / 部署到 Vercel

1. 将仓库推到 GitHub。
2. 在 Vercel 新建 Project 并导入仓库。
3. Framework Preset 选择 Astro。
4. Build Command 使用 `npm run build`，Output Directory 使用 `dist`。
5. 在 Vercel Project Settings 配置可选环境变量（见下文）。
6. 点击 Deploy。

## Configuration / 统一配置

所有核心配置集中在 `src/site.config.ts`，包括：

- 站点信息（title/description/hostname）
- 主题与布局
- 搜索与评论 Provider
- 首页/文章页 UI 参数
- 导航与页脚

## Environment Variables / 环境变量

可选变量（不配也能构建）：

```bash
# Giscus
PUBLIC_GISCUS_REPO=
PUBLIC_GISCUS_REPO_ID=
PUBLIC_GISCUS_CATEGORY=
PUBLIC_GISCUS_CATEGORY_ID=

# Algolia
PUBLIC_ALGOLIA_APP_ID=
PUBLIC_ALGOLIA_API_KEY=
PUBLIC_ALGOLIA_INDEX_NAME=

# AI
PUBLIC_AI_API_BASE_URL=
PUBLIC_AI_MODEL=
PUBLIC_AI_WIDGET_SRC=
PUBLIC_AI_WIDGET_IFRAME=

# Waline/Twikoo
PUBLIC_WALINE_SERVER=
PUBLIC_TWIKOO_ENV_ID=

# Encrypt script only
ENCRYPT_PASSWORD=
```

说明：若启用 Giscus，必须配置 `PUBLIC_GISCUS_REPO_ID` 与 `PUBLIC_GISCUS_CATEGORY_ID`。

## Interview Sorting / 面试中心排序

面试中心支持两层排序控制，默认都按 `order` 正序 `asc`：

- 分类首页卡片顺序：`src/content/interview/README.md`
- 分类内题目列表顺序：`src/content/interview/<space>/README.md`

全局分类顺序示例：

```md
---
title: Interview Center
spaceSortDirection: asc
---
```

分类内题目顺序示例：

```md
---
title: Java 面试题
order: 1
sortDirection: desc
---
```

规则说明：

- `spaceSortDirection: asc | desc` 控制面试中心首页分类卡片顺序
- `sortDirection: asc | desc` 控制当前分类下题目列表顺序
- 两层排序都先按 `order` 排，再按 `createTime` 作为同序号兜底
- 未配置时默认使用 `asc`

## Docs / 文档

- 总目录：`docs/README.md`
- 系统配置：`docs/config/system-config.md`
- Markdown 扩展：`docs/markdown/extended-syntax.md`
- 插件地图：`docs/plugins/plugin-map.md`
- 功能与语法总手册（博客）：`/article/system-user-guide/`
- 扩展开发总手册（博客）：`/article/system-extension-guide/`

## License

MIT License. See [LICENSE](./LICENSE).
