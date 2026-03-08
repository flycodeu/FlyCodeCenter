---
title: Astro 性能手册：把 JS 预算花在刀刃上
createTime: '2026/02/16 00:00:00'
code: ryz3mo5s
summary: 聚焦构建期优化与运行时按需加载，建立可持续的性能基线。
tags:
  - Astro
  - performance
  - dx
cover: >-
  https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=1200&q=80
---

## 为什么静态优先

静态化的核心价值是把计算前置到构建阶段，运行时只做必要工作。

## 搜索和评论按需加载

- 搜索弹窗打开后再加载索引。
- 评论区进入视口后再注入脚本。

## 性能预算建议

1. 首屏 JS 控制在可交互需求范围内。
2. 图片统一裁剪尺寸并懒加载。
3. 高频组件优先做结构复用而不是样式堆叠。

