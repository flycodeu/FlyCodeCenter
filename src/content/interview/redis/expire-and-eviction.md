---
title: Redis 的过期删除和内存淘汰策略
summary: Redis 面试高频综合题，通常会和缓存雪崩、击穿、穿透一起问。
description: 先说过期删除，再说淘汰策略，最后补充生产上的配置建议。
type: redis
difficulty: medium
order: 1
createTime: 2026/03/10 20:18:00
encrypted: true
passwordHint: 默认密码同隐藏空间入口
draft: false
---

## 回答主线

Redis 先通过过期删除处理已经设置 TTL 的 key，再在内存不足时通过淘汰策略回收内存，这两套机制解决的是不同问题。

## 过期删除策略

### 定时删除

给每个 key 单独建定时器成本太高，Redis 不采用这种方式。

### 惰性删除

访问 key 时再判断是否过期，优点是省 CPU，缺点是可能留下很多过期 key。

### 定期删除

Redis 会周期性随机抽取设置了过期时间的 key 检查并清理。

### 实际策略

Redis 实际上是惰性删除 + 定期删除的组合。

## 内存淘汰策略

只有在设置了 `maxmemory` 之后，Redis 才会触发淘汰。

常见策略：

- `noeviction`：不淘汰，直接报错
- `allkeys-lru`：所有 key 中淘汰最近最少使用
- `volatile-lru`：只在设置过期时间的 key 中淘汰
- `allkeys-random`：随机淘汰
- `volatile-ttl`：优先淘汰剩余 TTL 更短的 key

## 推荐答法

如果面试官问这一题，建议按这个顺序：

1. Redis 删除过期 key 主要靠惰性删除和定期删除。
2. 删除过期 key 解决的是无效缓存残留问题。
3. 内存淘汰解决的是内存打满问题，要先配置 `maxmemory`。
4. 生产中常见配置是 `allkeys-lru`。

## 延伸追问

### 为什么不是纯 LRU

Redis 为了性能使用的是近似 LRU，而不是绝对精确的 LRU。
