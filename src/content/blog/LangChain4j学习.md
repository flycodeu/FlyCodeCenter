---
title: LangChain4j学习
createTime: '2026/03/01 19:23:46'
code: b620e8cuv
permalink: /blog/b620e8cuv/
tags:
  - LangChain4j
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/0a234e4682107e18d9eba574bc12c263.jpg
---
# LangChain4j 使用指南

## 简介

LangChain4j 是 LangChain 的 Java 实现，旨在帮助开发者将大型语言模型（LLM）快速整合到 Java 应用中，支持聊天、RAG、函数调用、多模态输入等能力。

---

## 核心组件

### 1. ChatModel

`ChatModel` 是与 LLM 通信的接口，支持调用大语言模型生成回复。

```java
ChatModel model = QwenChatModel.withApiKey("your-key");
ChatResponse response = model.chat(UserMessage.from("你好"));
System.out.println(response.aiMessage().text());
```

### 2. AiService 接口

通过注解定义 AI 接口。

```java
@AiService
interface AiCodeHelperService {
    @SystemMessage(fromResource = "system-prompt.txt")
    String chat(String userMessage);
}
```

### 3. ChatMemory（聊天记忆）

用于实现上下文记忆支持。

```java
ChatMemory memory = MessageWindowChatMemory.withMaxMessages(10);
AiService service = AiServices.builder(MyService.class)
    .chatModel(chatModel)
    .chatMemory(memory)
    .build();
```

### 4. 多模态支持

LangChain4j 支持文本、图像混合输入：

```java
UserMessage userMessage = UserMessage.from(
    TextContent.from("描述图片"),
    ImageContent.from("https://example.com/image.jpg")
);
```

---

## 🧠 相关技术概念

### 🔁 1. RAG（Retrieval-Augmented Generation）检索增强生成

RAG 是 LangChain 中最核心的应用场景之一，其基本思想是：

> 在生成回答前，先“检索”相关信息，再把这些信息交给大模型进行“生成”。

**工作流程：**

1. 用户提出问题（Query）
2. 系统通过向量数据库进行语义检索
3. 检索出的文本作为上下文加入 prompt
4. 大模型生成回答

**在 LangChain4j 中支持：**

* `Retriever` 接口
* `EmbeddingModel`（向量生成）
* `VectorStore`（向量存储与检索）
* `RetrievalAugmentedChatMemory`（记忆+检索结合）

### 🕹️ 2. MCP（模块上下文协议）

LangChain4j 支持与外部 MCP 工具链进行集成，以扩展其上下文能力和工具调度能力。

```java
McpTransport transport = new HttpMcpTransport.Builder()
    .sseUrl("https://open.bigmodel.cn/api/mcp/web_search/sse?Authorization=" + apiKey)
    .logRequests(true)
    .logResponses(true)
    .build();
McpClient mcpClient = new DefaultMcpClient.Builder()
    .key("clientKey")
    .transport(transport)
    .build();
```

```java
AiServices.builder(AiCodeHelperService.class)
    .toolProvider(McpToolProvider.builder().mcpClients(mcpClient).build())
    .build();
```

### 📦 3. Prompt Template（提示词模板）

用于构造动态 prompt，便于参数化。

```java
PromptTemplate template = PromptTemplate.from("你是一个{role}，请帮助我{task}");
String prompt = template.apply(Map.of("role", "程序员", "task", "写一个冒泡排序"));
```

### 🧠 4. Memory（记忆系统）

* `MessageWindowChatMemory`: 限制消息数量
* `TokenWindowChatMemory`: 限制 token 长度
* `ChatMemoryStore`: 可持久化记忆（支持 Redis、MongoDB 等）

### 🧩 5. Tool & Function Call

LangChain4j 支持函数调用与工具集成：

```java
Tool weatherTool = Tool.builder()
    .name("getWeather")
    .description("获取城市天气")
    .executor(city -> getWeather(city))
    .build();
```

工具可以用于 Agent 执行环境中。

### 🧠 6. Agent 智能体

Agent 是具备推理和决策能力的智能体，LangChain4j 通过 ReAct 方式支持多工具调用。

```java
Agent agent = Agent.builder()
    .chatModel(chatModel)
    .tools(List.of(searchTool, calcTool))
    .build();
```

Agent 可根据上下文自动决定使用哪些工具。

### 🛡️ 7. Guardrails（输入输出防护）

用于控制 AI 输入或输出的安全与合规性。

```java
public class SafeInputGuardrail implements InputGuardrail {
    @Override
    public InputGuardrailResult validate(UserMessage userMessage) {
        // 检测敏感词、SQL注入等
        return success();
    }
}
```

### 📈 8. ChatModelListener（日志与可观测性）

监听模型请求、响应、错误：

```java
@Bean
ChatModelListener chatModelListener() {
    return new ChatModelListener() {
        public void onRequest(ChatModelRequestContext ctx) {
            log.info("Request: {}", ctx.chatRequest());
        }
        public void onResponse(ChatModelResponseContext ctx) {
            log.info("Response: {}", ctx.chatResponse());
        }
        public void onError(ChatModelErrorContext ctx) {
            log.error("Error: {}", ctx.error());
        }
    };
}
```

### 🔄 9. SSE 流式输出

支持以响应式方式输出 AI 响应内容：

```java
@GetMapping("/chat")
public Flux<ServerSentEvent<String>> chat(int memoryId, String message) {
    return aiCodeHelperService.chatStream(memoryId, message)
        .map(chunk -> ServerSentEvent.<String>builder().data(chunk).build());
}
```

需要启用 streaming-chat-model:

```yaml
langchain4j:
  community:
    dashscope:
      streaming-chat-model:
        model-name: qwen-max
        api-key: xxx
```
---

## 结论

LangChain4j 提供了 Java 基础下强大的 LLM 功能扩展，多模态，记忆，RAG，SSE 流式，结构化输出、工具调用、MCP 都有规范支持，非常适合构建个性化、处理处境下的 AI 应用。
