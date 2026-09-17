---
title: 复制List对象
createTime: '2026/03/01 19:23:46'
code: b2cj2nyy6
permalink: /blog/b2cj2nyy6/
tags:
  - SpringBoot
---

`BeanUtils.copyProperties` 复制可匹配的属性值，属于浅拷贝；嵌套对象和集合仍可能共享引用。下面要求目标类有可访问的无参构造器。

## 使用 BeanUtils
```java
package com.hmifo.common.utils;

import org.springframework.beans.BeanUtils;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class BeanCopyUtils {

    private BeanCopyUtils() {
    }

    public static <V> V copyBean(Object source, Class<V> clazz) {
        //创建目标对象
        V result = null;
        try {
            result = clazz.getDeclaredConstructor().newInstance();
            //实现属性copy
            BeanUtils.copyProperties(source, result);
        } catch (Exception e) {
            throw new IllegalArgumentException("无法创建或复制目标对象", e);
        }
        //返回结果
        return result;
    }

    public static <O, V> List<V> copyBeanList(List<O> list, Class<V> clazz) {
        return list.stream()
        .map(o -> copyBean(o, clazz))
        .collect(Collectors.toList());
    }
}
```
