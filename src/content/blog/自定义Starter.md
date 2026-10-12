---
title: 自定义Starter
createTime: '2026/03/01 19:23:46'
code: b89kow8hv
permalink: /blog/b89kow8hv/
tags:
  - SpringBoot
---

Starter 将可复用的依赖和自动配置交给其他项目使用。先用一个读取名称的例子理解“依赖被引入后，配置怎样被发现”。下面面向 Spring Boot 3、Java 17 以上。

## 创建普通 JAR 项目

保存 `pom.xml`，这里不添加可执行 JAR 的 repackage 插件：

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent><groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId><version>3.5.16</version>
    <relativePath/></parent>
  <groupId>example</groupId><artifactId>name-starter</artifactId><version>1.0.0</version>
  <properties><java.version>21</java.version></properties>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-autoconfigure</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-configuration-processor</artifactId><optional>true</optional></dependency>
  </dependencies>
</project>
```

## 编写三个类

放到 `src/main/java/demo/starter/`，保持 starter 包独立于消费项目的组件扫描范围：

```java
package demo.starter;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("demo.name")
public class NameProperties {
    private String owner = "visitor";
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
}
```

```java
package demo.starter;

public class NameClient {
    private final String owner;
    public NameClient(String owner) { this.owner = owner; }
    public String greet(String name) { return "Hello " + name + " from " + owner; }
}
```

```java
package demo.starter;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@EnableConfigurationProperties(NameProperties.class)
public class NameAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean(NameClient.class)
    public NameClient nameClient(NameProperties properties) {
        return new NameClient(properties.getOwner());
    }
}
```

每个 public 类存为同名文件。不通过 ComponentScan 搜索整个 starter，配置类明确声明需要的 Bean；消费方自行定义 NameClient 时，默认 Bean 会退让。

## 注册与使用

创建 `src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`，内容一行：

```text
demo.starter.NameAutoConfiguration
```

在 starter 根目录执行 `mvn install`，安装到自己的本地 Maven 仓库。在另一个 Boot 3 项目添加：

```xml
<dependency><groupId>example</groupId><artifactId>name-starter</artifactId><version>1.0.0</version></dependency>
```

消费项目的 application.yml：

```yaml
demo:
  name:
    owner: FlyCode
```

注入 NameClient，调用 `greet("reader")` 应得到 `Hello reader from FlyCode`。同时测试不配置 owner 时的 visitor 默认值，以及自定义 NameClient 后默认 Bean 不再创建。

Boot 3 不使用旧 `spring.factories` 的 EnableAutoConfiguration 键加载自动配置。配置处理器用于生成 IDE 元数据，不是发现配置类的机制。

参考：[Spring Boot 自定义自动配置](https://docs.spring.io/spring-boot/reference/features/developing-auto-configuration.html)。
