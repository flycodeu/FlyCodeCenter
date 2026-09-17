---
title: MyBatis-Plus的getOne多记录异常处理
createTime: '2026/03/01 19:23:46'
code: bp9br809l
permalink: /blog/bp9br809l/
tags:
  - Mybatis Plus
---

`getOne(queryWrapper)` 预期得到一条记录，匹配多行时通常会抛出异常。先判断业务条件是否应当唯一：如果应该唯一，应修复数据并建立相应唯一约束；如果允许多条，应明确选择规则。

## 业务只取排序后的第一条

MySQL 示例，假设 `id` 是唯一主键：

```java
LambdaQueryWrapper<User> query = Wrappers.<User>lambdaQuery()
        .eq(User::getStatus, status)
        .orderByAsc(User::getId)
        .last("LIMIT 1");
User user = userService.getOne(query);
```

`last()` 直接追加 SQL 片段，这里的内容必须由服务端固定，不能拼接用户输入。Oracle 等数据库应使用对应方言或分页插件，不能无条件在末尾追加 `and rownum = 1`，因为前面未必有 `WHERE`，排序位置也会影响结果。

`getOne(wrapper, false)` 控制多结果时是否抛出异常，不应把它理解为自动生成 `LIMIT 1`。需要单条查询时应明确限制 SQL 的返回规模。参见 [MyBatis-Plus 持久层接口](https://baomidou.com/guides/data-interface/) 与 [last 方法](https://baomidou.com/guides/wrapper/#last)。
