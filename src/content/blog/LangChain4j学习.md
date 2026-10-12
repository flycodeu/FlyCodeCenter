---
title: LangChain4j学习
createTime: '2026/03/01 19:23:46'
code: b620e8cuv
permalink: /blog/b620e8cuv/
tags:
  - LangChain4j
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/0a234e4682107e18d9eba574bc12c263.jpg
---

LangChain4j 是 Java 的模型应用框架。先学模型调用，再根据需要加入 AI Services、会话记忆、检索和工具；不要把其他框架的类名直接套进来。

## 一个完整的模型调用

本例使用 JDK 21、LangChain4j 1.22.0 和本机 Ollama。先按 [Ollama 教程](/blog/b2lb91htk/) 下载 `llama3.2:1b`。

在 Maven 项目加入：

```xml
<dependency>
  <groupId>dev.langchain4j</groupId><artifactId>langchain4j-ollama</artifactId><version>1.22.0</version>
</dependency>
```

保存 `src/main/java/LangChainDemo.java`，在 IDE 运行 main：

```java
import java.time.Duration;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.ollama.OllamaChatModel;

public class LangChainDemo {
    public static void main(String[] args) {
        ChatModel model = OllamaChatModel.builder()
                .baseUrl("http://127.0.0.1:11434")
                .modelName("llama3.2:1b")
                .timeout(Duration.ofSeconds(60))
                .build();
        System.out.println(model.chat("用一句话解释视频转码"));
    }
}
```

`ChatModel` 负责一次对话请求，模型名要与实际下载的模型一致。返回文字并不代表其中的事实已经验证。

## 各组件的作用

| 组件 | 做什么 |
| --- | --- |
| ChatModel / StreamingChatModel | 调用模型，分别返回完整或逐段结果 |
| AiServices | 把自己的 Java 接口方法映射为模型调用 |
| MessageWindowChatMemory | 限制某个会话保留的消息数量 |
| EmbeddingModel | 将文本转成向量 |
| EmbeddingStore 与 ContentRetriever | 存储向量并检索相关内容 |
| `@Tool` 方法 | 定义应用允许调用的业务操作 |

这些能力并非全都默认启用。图像、工具和结构化输出是否可用，还取决于模型与对应模块。

## 容易混淆的写法

LangChain4j 中不要把 Spring AI 的 VectorStore 名称当作相同接口，也不要假设存在通用的 `Tool.builder()` 或 `Agent.builder()`。具体 Agent 模块与模型能力需要按版本文档接入。

PromptTemplate 的占位符使用 `{{name}}` 这类模板语法，`apply(...)` 得到的是 Prompt，不是直接得到 Java String。例如在加入 `langchain4j` 核心依赖后，方法体里可以使用：

```java
var template = dev.langchain4j.model.input.PromptTemplate.from("你好，{{name}}");
var prompt = template.apply(java.util.Map.of("name", "FlyCode"));
System.out.println(prompt.text());
```

会话记忆的完整实践见 [LangChain4j 多轮对话](/blog/br6an5kff/)。

参考：[LangChain4j 文档](https://docs.langchain4j.dev/intro/)、[Ollama 集成](https://docs.langchain4j.dev/integrations/language-models/ollama)、[AI Services](https://docs.langchain4j.dev/tutorials/ai-services)。
