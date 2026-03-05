---
title: "Shortcode 与行内增强：可复用内容块实践"
createTime: "2026/03/05 14:52:00"
code: "sg0115"
permalink: "/article/sg0115/"
summary: "系统讲解 video、checkbox、hidden、admonition、mark/icon 的写法与效果。"
series: "system-guide"
order: 15
tags:
  - "tutorial"
  - "system-guide"
  - "shortcode"
  - "markdown"
cover: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80"
---

## 你将学到什么
- 常用 Shortcode 的语法与渲染效果。
- 如何让文档更具交互性与信息层次。

## 配置前置
```ts
markdown: {
  extended: {
    enable: true,
    mark: { enable: true },
    icon: { enable: true }
  }
}
```

## 示例
[video url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" width="640" height="360"]演示视频[/video]

[checkbox checked="true"]已完成[/checkbox]

[hidden tip="点击查看"]隐藏内容示例[/hidden]

[admonition title="警告" color="red"]请先在测试环境验证。[/admonition]

这是 ==重点=={.tip}，图标：:[mdi:rocket 18px/#0ea5e9]:

## 效果验证
- 预览页面中各 shortcode 应正确渲染。
- 行内 mark 与 icon 应可见且样式正确。

## 常见问题与排查
- 原样输出未渲染：检查 `markdown.extended.enable`。

## 下一篇预告
下一篇讲 Tabs / Steps / Demo 同屏示例。
