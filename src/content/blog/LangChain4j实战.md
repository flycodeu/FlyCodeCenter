---
title: LangChain4j 实战：按会话保存对话
createTime: '2026/03/01 19:23:46'
code: br6an5kff
permalink: /blog/br6an5kff/
tags:
  - LangChain4j
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/639a06e3e1aef9dc0eead20503100577.jpg
---

本篇给同一个模型增加按会话隔离的记忆。先观察两组对话，再把代码放进业务服务；生成文件和执行代码不属于本例。

## 准备环境

沿用 [LangChain4j 模型调用](/blog/b620e8cuv/)，使用 JDK 21 与本机 Ollama。Maven 加入同一版本的两个模块：

```xml
<dependency>
  <groupId>dev.langchain4j</groupId><artifactId>langchain4j</artifactId><version>1.22.0</version>
</dependency>
<dependency>
  <groupId>dev.langchain4j</groupId><artifactId>langchain4j-ollama</artifactId><version>1.22.0</version>
</dependency>
```

不要把不同版本的 core、Spring Boot starter 和 reactor 适配模块拼在一起。本例不需要 Spring Boot starter。

## 多轮对话程序

保存 `src/main/java/AiMemoryDemo.java`：

```java
import java.time.Duration;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.UserMessage;

public class AiMemoryDemo {
    public interface Assistant {
        String chat(@MemoryId String conversationId, @UserMessage String question);
    }

    public static void main(String[] args) {
        ChatModel model = OllamaChatModel.builder()
                .baseUrl("http://127.0.0.1:11434")
                .modelName("llama3.2:1b")
                .timeout(Duration.ofSeconds(60))
                .build();
        Assistant assistant = AiServices.builder(Assistant.class)
                .chatModel(model)
                .chatMemoryProvider(id -> MessageWindowChatMemory.withMaxMessages(10))
                .build();
        System.out.println(assistant.chat("session-A", "我叫小明，请记住本次对话中的名字。"));
        System.out.println(assistant.chat("session-B", "我叫小红，请记住本次对话中的名字。"));
        System.out.println(assistant.chat("session-A", "我在这次对话里说自己叫什么？"));
    }
}
```

在 IDE 运行 main。第三次调用沿用 A 的历史，不应把 B 的历史混进请求；具体回复仍由模型决定，可以通过调试观察传给模型的消息列表确认隔离。

`@MemoryId` 指定会话，`@UserMessage` 指定用户输入。窗口上限是消息数量，不是轮数或 token 数；超过窗口会淘汰旧消息，进程重启后内存历史会丢失。

## 放进后端之前

- 会话 ID 必须与已登录用户和会话归属校验绑定，不能让用户填写其他人的 ID 后读取历史。
- 同一会话的并发请求要协调，避免历史顺序交叉；不同会话也要限制总数量与存活期限。
- 持久化使用明确的数据格式和版本，避免把任意 Java 对象序列化文件当作长期协议。
- 模型生成的 HTML、文件名与代码均为不可信输入，展示、保存和执行需要分别验证。

流式调用使用 StreamingChatModel 与对应的服务方法返回类型，不能只把同步方法的 String 返回值改成 Flux 就假定完成。结构化输出也需要在最终文本齐全后按对应 API 转换并验证，不能随意用正则拆分模型代码块。

参考：[Chat Memory](https://docs.langchain4j.dev/tutorials/chat-memory)、[AI Services](https://docs.langchain4j.dev/tutorials/ai-services)。
