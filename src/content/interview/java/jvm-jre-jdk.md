---
title: JDK、JRE、JVM 的区别
summary: 这是 Java 基础必问题，回答重点在于三者层级关系和开发运行场景。
description: 理清 JDK、JRE、JVM 的概念边界，并给出适合面试表达的回答结构。
type: java
difficulty: easy
order: 1
createTime: 2026/03/10 20:12:00
encrypted: true
passwordHint: 默认密码同隐藏空间入口
draft: false
---

## 一句话回答

JVM 是执行 Java 字节码的虚拟机，JRE 是运行 Java 程序所需的运行环境，JDK 是在 JRE 基础上增加了编译器和开发工具的完整开发套件。

## 面试展开方式

### 1. JVM 是什么

- JVM 负责把 `.class` 字节码加载到内存并执行。
- Java 跨平台的核心原因就是不同操作系统上都有各自实现的 JVM。

### 2. JRE 是什么

- JRE 包含 JVM 和 Java 标准类库。
- 只运行 Java 程序时，理论上安装 JRE 就够了。

### 3. JDK 是什么

- JDK = JRE + 开发工具。
- 常见工具包括 `javac`、`javadoc`、`jdb`、`jar`。

## 最佳回答模板

如果面试官问三者区别，我一般会按“执行层、运行层、开发层”来回答：

1. JVM 是执行层，负责真正运行字节码。
2. JRE 是运行层，给 Java 程序提供运行环境。
3. JDK 是开发层，除了运行环境，还包含编译和调试工具。

## 追问方向

### 为什么现在很多场景只装 JDK

因为新版本里开发和运行环境通常一起装，运维和开发都直接使用 JDK，管理更统一。

### Java 跨平台到底依赖什么

依赖的是字节码加 JVM，而不是源代码直接跨平台。
