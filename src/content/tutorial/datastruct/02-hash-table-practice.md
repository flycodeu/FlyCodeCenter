---
title: "HashTable 实战：冲突处理与装载因子"
createTime: "2026/02/13 00:00:00"
code: "r3h9p5zw"
permalink: "/article/r3h9p5zw/"
summary: "结合冲突场景和装载因子，掌握哈希表扩容与性能取舍。"
tags:
  - "tutorial"
  - "datastruct"
  - "hash"
cover: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=1200&q=80"
---

## 冲突不可避免

不同 key 经过 hash 可能映射到同一个桶位，需要冲突解决策略。

## 装载因子

$$
\alpha = \frac{n}{m}
$$

当装载因子过高时，查找性能会下降，需要 rehash 扩容。

