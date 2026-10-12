---
title: Java 安装：检查 JDK 与 JAVA_HOME
createTime: '2026/03/01 19:23:46'
code: b1tgjq42m
permalink: /blog/b1tgjq42m/
tags:
  - Java
---

Java 项目要区分运行环境和开发工具。运行已有 JAR 需要 Java runtime，编译源码还需要 `javac`；安装 JDK 通常包含两者。

## 安装与确认版本

从 [Eclipse Temurin](https://adoptium.net/temurin/releases/) 或项目指定的 JDK 厂商下载匹配操作系统与架构的 JDK。本例用 JDK 21，但实际版本要按项目构建要求选择。

安装后在 PowerShell 检查：

```powershell
java -version
javac -version
Get-Command java,javac | Select-Object Name,Source
```

如果 java 和 javac 来自不同目录，先调整 PATH 的查找顺序。只安装 JRE 时可能找不到 javac。

## 为当前终端设置 JDK

下面路径替换为自己的 JDK 根目录，里面应存在 `bin/java.exe` 和 `bin/javac.exe`：

```powershell
$env:JAVA_HOME = 'D:\Tools\jdk-21'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
java -version
javac -version
mvn -version
```

设置只影响当前终端及其子进程。系统环境变量要在 Windows 设置中配置，重新打开终端后才会读取；IDE 还可能使用自己配置的项目 JDK 与 Maven JDK。

## 编译一个文件

保存 `Hello.java`：

```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello Java");
    }
}
```

```powershell
javac Hello.java
java Hello
```

编译生成 `Hello.class`，运行时写类名 `Hello`，不加 `.class`。已有 Java 8 项目不能仅因为装了 JDK 21 就假定兼容，需要检查源码、依赖和目标字节码版本。
