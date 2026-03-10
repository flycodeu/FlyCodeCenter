---
title: 字体系统与预设：regular / pixel 的切换机制
createTime: '2026/03/05 12:57:49'
code: t1ymnkmrw
permalink: /article/t1ymnkmrw/
summary: 掌握字体预设定义、默认值设置、运行时切换与页面一致性。
series: system-guide
order: 10
tags:
  - tutorial
  - system-guide
  - font
cover: https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=1600&q=80
---

## 你将学到什么
- `theme.typography` 字体预设如何生效。
- 如何定义 regular 与 pixel 两套字体变量。

## 配置示例
```ts
theme: {
  typography: {
    fontPresetDefault: "regular",
    fontPresets: {
      regular: { sans: "...", serif: "...", display: "...", tech: "...", mono: "..." },
      pixel: { sans: "...", serif: "...", display: "...", tech: "...", mono: "..." }
    }
  }
}
```

## 运行时调试
```js
document.documentElement.dataset.fontPreset = "regular"
document.documentElement.dataset.fontPreset = "pixel"
```

## 效果验证
- 切换后正文、标题、代码字体按预期变化。
- 页面切换后字体状态保持一致。

## 常见问题与排查
- 字体无变化：检查 `data-font-preset` 是否被覆盖。
- 显示异常：检查字体栈是否包含可用回退字体。

## 下一篇预告
下一篇结合主题包讲“像素风”整体视觉。
