---
title: 简单Java爬虫
createTime: '2026/03/01 19:23:46'
code: bjhex8h9z
permalink: /blog/bjhex8h9z/
tags:
  - SpringBoot
  - 爬虫
---

先用自己准备的 HTML 学会选择元素，再处理网络请求。下面使用 Java 17 以上与 jsoup 1.23.2，不依赖搜索引擎的内部接口或变化中的页面结构。

## 建立最小 Maven 项目

保存 `pom.xml`：

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>example</groupId><artifactId>html-demo</artifactId><version>1.0.0</version>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
  <dependencies><dependency>
    <groupId>org.jsoup</groupId><artifactId>jsoup</artifactId><version>1.23.2</version>
  </dependency></dependencies>
</project>
```

保存 `src/main/java/HtmlDemo.java`：

```java
import org.jsoup.Jsoup;

public class HtmlDemo {
    public static void main(String[] args) {
        String html = """
                <ul class="books">
                  <li><a href="/book/1">Java 入门</a></li>
                  <li><a href="/book/2">网络基础</a></li>
                </ul>
                """;
        var document = Jsoup.parse(html, "https://example.com/");
        var links = document.select("ul.books li a[href]");
        if (links.isEmpty()) throw new IllegalStateException("没有匹配元素");
        for (var link : links) {
            System.out.println(link.text() + " -> " + link.absUrl("href"));
        }
    }
}
```

PowerShell 执行：

```powershell
mvn package dependency:copy-dependencies
java -cp 'target/classes;target/dependency/*' HtmlDemo
```

Linux/macOS 的 classpath 分隔符是冒号。预期输出两条完整地址。改动 HTML 的 class 后，程序会明确报告未匹配，而不是对空集合调用 get(0)。

## 加入 HTTP 请求

在 main 方法里将 `Jsoup.parse` 替换为 `Jsoup.connect(自己的页面地址).timeout(10000).maxBodySize(1024 * 1024).get()`，并让 main 声明 `throws java.io.IOException`。选择器要按返回 HTML 调整；浏览器显示的内容可能由 JavaScript 生成，不在这次 HTTP 响应中。

请求失败就处理异常，不继续使用空 Document。状态成功但结果为空时，检查响应类型、登录页、选择器和动态加载。批量访问前确认网站使用规则，设置频率与总量限制；不循环重试所有错误。

提取图片地址见 [图片链接解析](/blog/b1ffx6d3g/)。参考：[jsoup 入门](https://jsoup.org/cookbook/)、[下载与依赖](https://jsoup.org/download)。
