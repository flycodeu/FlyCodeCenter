---
title: 代码主题映射：随站点明暗自动同步
createTime: '2026/03/05 12:57:49'
code: t2bnrb2vi
permalink: /article/t2bnrb2vi/
summary: 建立 site theme -> code theme 映射，让高亮风格与全站主题联动。
series: system-guide
order: 13
tags:
  - tutorial
  - system-guide
  - code
  - theme
cover: https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=1600&q=80
---

## 你将学到什么
- 为什么要做代码主题映射。
- 如何在主题包中定义 `codeThemeMap`。

## 配置示例
```ts
codeThemeMap: {
  "nature-light": "github-light",
  "nature-dark": "github-dark"
}
```

## 工作机制
1. 页面读取当前站点主题。
2. 根据 `codeThemeMap` 解析目标代码主题。
3. 同步到 `data-code-theme` 并更新代码块外观。

## 效果验证
- 切换主题后，代码块主题自动变化。
- 刷新页面后主题保持一致。

## 常见问题与排查
- 不同步：检查 `data-theme-code-map` 是否注入到 html。
- 同步延迟：检查页面切换事件是否触发。

## 下一篇预告
下一篇讲 Markdown 扩展总开关与 parserMode。
