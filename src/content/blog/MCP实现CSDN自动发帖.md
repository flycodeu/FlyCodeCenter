---
title: MCP文章工具：预览草稿与人工发布
createTime: '2026/03/01 19:23:46'
code: b1c38p4k4
permalink: /blog/b1c38p4k4/
tags:
  - MCP
  - AI
cover: 'https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/bg05.jpg'
---

MCP 可以让模型调用程序中的工具，但平台发布接口、账号认证和内容审核仍由发布平台决定。浏览器抓包得到的 CSDN 内部接口不是稳定开放 API，复制旧 Cookie、签名和请求字段不能构成可长期复用的发帖方案。

下面把示例改成“生成并预览草稿”。检查标题和正文后，在 [CSDN 编辑器](https://editor.csdn.net/md/) 中粘贴并发布。程序没有自动发布功能。

## 先跑通工具调用

按 [Spring AI 接入 MCP](/blog/b2awd9f6e/) 建立 Java 21、Spring Boot 3.5.16、Spring AI 1.1.8 的 STDIO 服务。使用 `spring-ai-starter-mcp-server`，在启动类扫描范围内保存 `ArticleDraftTools.java`，包名替换为自己的：

```java
package example;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
public class ArticleDraftTools {
    @Tool(description = "预览文章草稿，不保存、不发布")
    public String previewArticle(
            @ToolParam(description = "文章标题") String title,
            @ToolParam(description = "Markdown 正文") String markdown) {
        if (title == null || title.isBlank() || title.length() > 120) {
            throw new IllegalArgumentException("标题长度须为 1 到 120 个字符");
        }
        if (markdown == null || markdown.isBlank() || markdown.length() > 20000) {
            throw new IllegalArgumentException("正文长度须为 1 到 20000 个字符");
        }
        return "# " + title.strip() + "\n\n" + markdown;
    }
}
```

在已有启动类里注册这个工具，替换原来的工具注册方法：

```java
@Bean
ToolCallbackProvider articleTools(ArticleDraftTools tools) {
    return MethodToolCallbackProvider.builder().toolObjects(tools).build();
}
```

所需导入为 `org.springframework.context.annotation.Bean`、`org.springframework.ai.tool.ToolCallbackProvider`、`org.springframework.ai.tool.method.MethodToolCallbackProvider`。

STDIO 配置使用 `spring.ai.mcp.server.stdio=true`。日志写文件或 stderr，stdout 留给协议消息；不能往里面打印文章调试信息。

## 检查结果再发布

1. 让 MCP 客户端列出工具，确认存在 `previewArticle`。
2. 请求生成一篇短草稿，确认工具被调用；模型直接返回正文不等于调用了工具。
3. 检查引用、代码和图片来源，将 Markdown 粘贴进编辑器。
4. 在平台确认可见范围、分类和正文后发布，核对文章地址。

若以后接入平台正式发布 API，单独实现认证、参数校验、幂等和失败查询。MCP 工具描述不能替代这些检查，API 返回 HTTP 200 也不能单独证明发布成功。

参考：[Spring AI MCP 服务端](https://docs.spring.io/spring-ai/reference/1.1/api/mcp/mcp-server-boot-starter-docs.html)。
