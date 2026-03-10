---
title: Markdown 扩展总开关：extended.enable 与 parserMode
createTime: '2026/03/05 12:57:49'
code: tjxwqbvk9
permalink: /tutorials/tjxwqbvk9/
summary: 从总开关视角理解扩展 Markdown 的启停策略与构建时解析模式。
series: system-guide
order: 14
tags:
  - tutorial
  - system-guide
  - markdown
cover: https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80
---

## 你将学到什么
- `markdown.extended.enable` 的作用边界。
- `parserMode` 的构建时与运行时差异。

## 配置示例
```ts
markdown: {
  extended: {
    enable: true,
    parserMode: "build-time",
    tabs: { enable: true },
    steps: { enable: true },
    demoBlock: { enable: true }
  }
}
```

## 建议策略
- 生产环境优先 `build-time`，减少运行时不确定性。
- 新能力先小范围试点，再全站启用。

## 效果验证
- 关闭 `extended.enable` 后，扩展语法不再渲染。
- 打开后，Tabs/Steps 等语法恢复可用。

## 常见问题与排查
- 某个扩展失效：检查该扩展开关是否单独开启。

## 下一篇预告
下一篇进入 Shortcode 与行内增强（video/checkbox/hidden/admonition/mark/icon）。
