---
title: "数学公式复制与行内图标：技术文档表达增强"
createTime: "2026/03/05 15:16:00"
code: "sg0118"
permalink: "/article/sg0118/"
summary: "配置并验证数学公式复制能力与行内 icon 渲染能力。"
series: "system-guide"
order: 18
tags:
  - "tutorial"
  - "system-guide"
  - "math"
  - "icon"
cover: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- 数学公式（行内/块级）渲染与复制。
- iconify 行内图标的配置与写法。

## 配置示例
```ts
markdown: {
  math: { enable: true },
  copy: { math: true },
  extended: {
    icon: {
      enable: true,
      provider: "iconify",
      bundleUrl: "https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"
    }
  }
}
```

## 示例
行内公式：$E = mc^2$

$$
\int_0^1 x^2 dx = \frac{1}{3}
$$

图标：:[mdi:math-integral 18px/#0284c7]:

## 效果验证
- 公式渲染正常，复制按钮可用。
- 图标能正确显示并带样式。

## 常见问题与排查
- 公式显示原文本：检查 math 开关与 KaTeX 资源。

## 下一篇预告
下一篇讲搜索、索引和性能相关配置。
