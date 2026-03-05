---
title: "代码块能力：高亮、复制、行号、窗口条"
createTime: "2026/03/05 14:28:00"
code: "sg0112"
permalink: "/article/sg0112/"
summary: "配置与展示代码块核心能力，确保在教程与博客中稳定可用。"
series: "system-guide"
order: 12
tags:
  - "tutorial"
  - "system-guide"
  - "code"
cover: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- 代码高亮 provider 的选择。
- 复制按钮、行号、窗口标题条的开关与效果。

## 配置示例
```ts
codeHighlight: {
  provider: "expressive",
  lineNumbers: true,
  window: { titleMode: "lang" }
},
markdown: {
  copy: { code: true }
}
```

## 示例
```ts
const message = "hello flycode"
console.log(message)
```

```bash
npm run dev
npm run build
```

## 效果验证
- 悬停出现复制按钮。
- 行号显示正常。
- 语言标题显示在窗口条。

## 常见问题与排查
- 颜色错乱：检查 provider 与 code theme 是否匹配。
- 无复制按钮：检查 `markdown.copy.code`。

## 下一篇预告
下一篇讲站点主题与代码主题自动映射。
