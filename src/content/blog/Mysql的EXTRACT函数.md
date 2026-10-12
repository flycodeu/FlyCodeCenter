---
title: Mysql的EXTRACT函数
createTime: '2026/03/01 19:23:46'
code: b11p7gf8a
permalink: /blog/b11p7gf8a/
tags:
  - MySQL
---

MySQL 的 `EXTRACT` 从日期时间中提取指定部分。可先在 MySQL 客户端运行不依赖业务表的例子：

```sql
SELECT
    EXTRACT(YEAR FROM '2026-09-01 08:30:00') AS delivery_year,
    EXTRACT(MONTH FROM '2026-09-01 08:30:00') AS delivery_month,
    EXTRACT(DAY FROM '2026-09-01 08:30:00') AS delivery_day;
```

结果分别是 `2026`、`9`、`1`。放到已有表时，替换为实际字段名：

```sql
SELECT EXTRACT(YEAR FROM delivery_time) AS delivery_year
FROM orders;
```

`orders` 和 `delivery_time` 必须已存在。按日期筛选大量数据时，优先评估日期范围条件，如 `delivery_time >= '2026-01-01' AND delivery_time < '2027-01-01'`；直接对普通索引字段套函数可能影响索引使用，需看执行计划。

参考：[MySQL 日期时间函数](https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_extract)。
