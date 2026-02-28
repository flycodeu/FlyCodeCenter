---
title: "ArrayList 入门：动态数组的扩容策略"
description: "理解容量、扩容倍数与摊还复杂度。"
summary: "从结构特性到复杂度分析，快速建立动态数组的实战认知。"
pubDate: 2026-02-10
updatedDate: 2026-02-12
tags: ["tutorial", "datastruct", "array"]
cover: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80"
draft: false
series: "datastruct"
order: 1
encrypted: false
---

## 动态数组是什么

动态数组在逻辑上是连续空间，容量不足时会触发扩容并搬移数据。

## 复杂度

- 随机访问：`O(1)`
- 末尾插入：摊还 `O(1)`
- 中间插入：`O(n)`

