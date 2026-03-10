---
title: ArrayList 入门：动态数组的扩容策略
createTime: '2026/02/28 16:21:20'
code: t28k9xljt
permalink: /article/t28k9xljt/
summary: 从结构特性到复杂度分析，快速建立动态数组的实战认知。
tags:
  - tutorial
  - datastruct
  - array
cover: https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80
---

## 动态数组是什么

动态数组在逻辑上是连续空间，容量不足时会触发扩容并搬移数据。

## 复杂度

- 随机访问：`O(1)`
- 末尾插入：摊还 `O(1)`
- 中间插入：`O(n)`

