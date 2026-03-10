---
title: HashMap 为什么线程不安全
createTime: '2026/03/10 20:14:00'
code: imd6p1ffd
permalink: /interview/imd6p1ffd/
summary: 这道题常见于集合和并发交叉面试，重点是并发写导致的数据错乱。
description: 从 JDK 1.7 和 1.8 两代实现角度解释 HashMap 的线程安全问题。
order: 2
type: java
difficulty: medium
encrypted: true
passwordHint: 默认密码同隐藏空间入口
draft: false
---

## 核心结论

HashMap 在并发场景下没有加锁保护，多线程同时 `put` 或扩容时，可能造成数据覆盖、链表或树结构异常，最终表现为数据丢失或读取不一致。

## 为什么不安全

### 1. put 不是原子操作

计算 hash、定位桶位、插入节点、更新 size 是多个步骤，中间可能被别的线程打断。

### 2. 扩容时会重排数据

扩容需要重新分配桶数组并迁移节点。

- 在 JDK 1.7 中，多线程扩容可能导致链表成环。
- 在 JDK 1.8 中虽然优化了迁移逻辑，但仍然不能保证线程安全。

### 3. 可见性也没有保证

一个线程写入的新节点，另一个线程不一定马上可见。

## 面试回答模板

可以直接这样答：

> HashMap 线程不安全，根本原因是它没有任何同步控制。并发写时，put 和 resize 都可能交叉执行，导致数据覆盖、迁移异常甚至死循环问题。JDK 1.8 解决了 1.7 的链表成环隐患，但依旧不是线程安全容器。

## 怎么替代

- 高并发读写场景优先用 `ConcurrentHashMap`
- 单线程或明确无并发场景再使用 `HashMap`

## 面试官可能继续追问

### ConcurrentHashMap 为什么更安全

因为它对并发更新做了分段控制或 CAS + synchronized 保护。

### Hashtable 为什么不推荐

虽然线程安全，但锁粒度太粗，性能较差。
