---
title: "HashTable 实战：冲突处理与装载因子"
description: "通过链地址法理解哈希表性能边界。"
summary: "结合冲突场景和装载因子，掌握哈希表扩容与性能取舍。"
pubDate: 2026-02-13
updatedDate: 2026-02-15
tags: ["tutorial", "datastruct", "hash"]
cover: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=1200&q=80"
draft: false
series: "datastruct"
order: 2
encrypted: false
---

## 冲突不可避免

不同 key 经过 hash 可能映射到同一个桶位，需要冲突解决策略。

## 装载因子

$$
\alpha = \frac{n}{m}
$$

当装载因子过高时，查找性能会下降，需要 rehash 扩容。

