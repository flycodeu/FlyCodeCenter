---
title: Tabs 与 Steps：结构化教程的表达方式
createTime: '2026/03/05 12:58:50'
code: t2nt5h4mo
permalink: /tutorials/t2nt5h4mo/
summary: 用 Tabs、Steps 和 Demo 模块构建更易读的多方案教程。
series: system-guide
order: 16
tags:
  - tutorial
  - system-guide
  - tabs
  - steps
cover: https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1600&q=80
---

## 你将学到什么
- 何时使用 Tabs（多语言/多方案）。
- 何时使用 Steps（流程化任务）。

## Tabs 示例
::: tabs
@tab TypeScript
```ts
console.log("Hello TypeScript")
```

@tab Rust
```rust
fn main() {
  println!("Hello Rust");
}
```
:::

## Steps 示例
:::: steps
- 拉取代码
- 安装依赖
- 本地运行
- 打包发布
::::

## Demo 同屏示例
[demo title="Mermaid 演示" lang="mermaid" mode="split" result="auto"]
```mermaid
flowchart LR
  A[Plan] --> B[Build]
  B --> C[Test]
```
预览区自动渲染，源码区保留原始代码。
[/demo]

## 效果验证
- Tab 切换顺畅。
- Steps 编号和样式正确。

## 常见问题与排查
- Tabs 没有样式：检查 `markdown.extended.tabs.enable`。

## 下一篇预告
下一篇进入图表与流程图能力。
