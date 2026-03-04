# FlyCodeCenter Astro Blog

静态优先、可插拔 provider、按需加载的 Astro 博客工程。

## 本地启动

```bash
npm install
npm run dev
```

## 构建与预览

```bash
npm run build
npm run preview
```

`build` 后会自动执行 `postbuild`：

1. 生成 `minisearch` 索引（`public/search/minisearch.json` 与 `dist/search/minisearch.json`）
2. 生成 `pagefind` 索引（`dist/pagefind`）

## 关键命令

```bash
npm run build:minisearch
npm run build:pagefind
npm run encrypt
```

## Vercel 部署（<= 6 步）

1. 把仓库推到 GitHub。
2. 在 Vercel 新建 Project 并导入仓库。
3. Framework Preset 选择 Astro（默认即可）。
4. Build Command 使用 `npm run build`，Output Directory 使用 `dist`。
5. 在 Vercel Project Settings 配置可选环境变量（见下文）。
6. 点击 Deploy。

## 环境变量

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

## 统一配置

所有可变项集中在 `src/site.config.ts`：

- SEO、hostname、sitemap、rss、robots
- 博客排序（置顶优先）
- 卡片封面布局（左/右/无图）与封面高度/样式
- 分页策略（`page` / `loadMore`）
- 搜索 provider（`minisearch` / `pagefind` / `algolia`）
- 评论 provider（`giscus` / `waline` / `twikoo`）
- AI 看板连接策略（默认 `openaiCompatible`，支持前端自定义 API Base / Model / Key）
- Mermaid / Draw.io / ECharts 图形能力开关
- 看板娘开关与行为参数
- 网站收藏中心分类与卡片排序（`src/content/sites/*.md` + `site.config.ts`）
- 资源页与收藏页开关

## 文档入口

- 总目录：`docs/README.md`
- 系统配置：`docs/config/system-config.md`
- Markdown 扩展：`docs/markdown/extended-syntax.md`
- 插件地图：`docs/plugins/plugin-map.md`
- 功能与语法总手册（博客）：`/article/system-user-guide/`
- 扩展开发总手册（博客）：`/article/system-extension-guide/`

## 新增页面

- `/tags`：标签统计中心（`/types` 与 `/types/[domain]` 保留兼容跳转）
- `/sites`：网站收藏中心（多分类 + 主题化展示）
- `/reading`：优秀文章收集

## 文章 Frontmatter 最简模式

仅 `title` 必填，其它字段均可选。示例：

```md
---
title: "我的新文章"
---
```

## 文章内插入卡片

在 `.mdx` 中可使用 `MediaCard`，支持图片位置、宽高与卡片尺寸：

```mdx
import MediaCard from "@/components/mdx/MediaCard.astro";

<MediaCard
  title="示例卡片"
  desc="支持图片在 left/right/top/background。"
  image="/demo.png"
  imagePosition="right"
  imageWidth={240}
  imageHeight={140}
/>
```

## Markdown 图形语法

文章内可使用以下 fenced code：

~~~md
```mermaid
flowchart LR
A-->B
```

```drawio
https://your-drawio-file-url
```

```chart
{ "xAxis": {"type":"category"}, "yAxis": {"type":"value"}, "series": [{"type":"bar","data":[1,2,3]}] }
```
~~~

图形脚本按需加载，仅在文章出现对应代码块时加载。

## 加密边界说明

这是静态站前端解密方案（AES-GCM + PBKDF2），适合降低明文暴露风险，不等同于后端鉴权。  
拥有构建产物和足够分析能力的攻击者仍可尝试离线破解，因此不适合高敏感数据。

