---
title: 全局配置入口：site.config.ts 结构化解读
createTime: '2026/03/05 12:57:01'
code: t218mai2w
permalink: /article/t218mai2w/
summary: 掌握全局配置入口：如何找到功能开关、如何安全修改并验证。
series: system-guide
order: 2
tags:
  - tutorial
  - system-guide
  - config
cover: https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80
---

## 你将学到什么
- `site.config.ts` 的核心分区。
- 如何修改配置而不引入连锁回归。
- 改完配置后的验证路径。

## 环境与前置条件
- 已能运行 `npm run dev`
- 熟悉 TypeScript 对象结构

## 关键配置分区
```ts
const siteConfig = defineSiteConfig({
  site: {},
  theme: {},
  markdown: {},
  codeHighlight: {},
  comment: {},
  pages: {}
} as const)
```

## 修改步骤
1. 在 `theme`、`markdown`、`comment` 中找到目标开关。
2. 小步修改：一次只改一个能力块。
3. 本地验证页面表现。
4. 执行构建验证：

```bash
npm run build
```

## 安全改动原则
- 保持字段类型不变。
- 优先新增配置，不直接删除旧配置。
- 涉及 provider 的改动，要同步检查环境变量。

## 效果验证
- 修改 `theme.logo.text`，刷新页面观察 Header。
- 修改 `theme.footer.message`，观察底部栏文本变化。

## 常见问题与排查
- 配置改了但没生效：确认是否改在正确层级。
- 构建报类型错：核对联合类型和值是否合法。

## 下一篇预告
下一篇会讲内容集合与路由规则，解释教程是如何被索引并生成页面的。
