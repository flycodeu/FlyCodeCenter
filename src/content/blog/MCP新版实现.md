---
title: MCP新版实现
createTime: '2026/03/01 19:23:46'
code: b2awd9f6e
permalink: /article/b2awd9f6e/
tags:
  - MCP
  - AI
cover: 'https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/bg04.jpg'
---

## 🖥️ 基于 Spring AI 的本地与在线 MCP 客户端接入实战

Spring AI 支持本地与在线模型的统一封装调用，结合 MCP（Model Context Protocol）协议，可实现 AI 与文件系统交互、自动生成文件等强大能力。

本文将分别介绍：

- ✅ 基于 **本地 Ollama + Qwen3** 模型实现文件操作
- ✅ 基于 **ZhiPu AI 在线模型** 实现远程工具调用

------

## 🚀 本地 Ollama + Qwen3 模型接入 MCP 实践

[Spring AI](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-client-boot-starter-docs.html)

### ✅ 推荐模型：Qwen3

使用 [Qwen3 模型](https://ollama.com/library/qwen3)，原因如下：

- ✅ 支持 MCP 工具调用
- 🚫 其他模型（如 deepseek）当前不支持 MCP 工具

------

### 1️⃣ 引入依赖

```xml

<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-ollama-spring-boot-starter</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-mcp-server-spring-boot-starter</artifactId>
</dependency>
```

------

### 2️⃣ 配置 `application.yml`

```yaml
spring:  
  ai:
    ollama:
      base-url: http://172.26.37.0:11434
      embedding:
        enabled: true
        model: nomic-embed-text
        options:
          num-batch: 512
    mcp:
      client:
        stdio:
          servers-configuration: classpath:config/mcp-servers.json
```

------

### 3️⃣ MCP 工具配置 `mcp-servers.json`

在不使用本地服务的情况下，你也可以接入以下 **云端托管的 MCP Server**：

- 🔗 [Smithery AI MCP 服务](https://smithery.ai/)
- 🔗 [Glama MCP 服务](https://glama.ai/mcp/servers)

它们支持通过浏览器接入标准 MCP 工具链，适合快速接入和调试。

------

#### 🖥️ 本地文件操作：server-filesystem 模式

若使用 `server-filesystem` 工具运行在本地环境，可实现如下能力：

- 📂 **读取 / 写入 / 删除本地文件**
- 📁 **操作指定目录下的文件结构**
- ✅ **完整支持 MCP 文件类工具接口**

但需注意以下前提条件：

- 本地需安装好 **Node.js 和 npm**
- 全局安装或通过 `npx`
  调用 [`@modelcontextprotocol/server-filesystem`](https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem)

示例启动命令配置如下：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx.cmd",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\flycode\\Desktop\\temp"
      ]
    }
  }
}
```

📌 配置说明：

- MCP 工具将操作 `C:\\Users\\flycode\\Desktop\\temp` 目录
- 可通过 Ollama 实现 AI 与文件系统的交互

------

### 4️⃣ Spring Bean 配置

```java
@Configuration
public class OllamaConfig {
    @Bean
    public ChatClient.Builder ollamaChatClientBuilder(OllamaChatModel ollamaChatModel) {
        return new DefaultChatClientBuilder(
            ollamaChatModel, 
            ObservationRegistry.NOOP, 
            (ChatClientObservationConvention) null
        );
    }
}
```

------

### 5️⃣ 调用测试：生成本地文件

```java
@Resource
private ToolCallbackProvider toolCallback;
@Resource
private ChatClient.Builder ollamaChatClientBuilder;

@Test
public void makeNewText() {
    String prompt = "帮我生成一个测试.txt文件到C:\\Users\\flycode\\Desktop\\temp位置，并且内容是测试xxxx";
    
    String text = ollamaChatClientBuilder
        .defaultTools(toolCallback)
        .build()
        .prompt(new Prompt(prompt, OllamaOptions.builder().model("qwen3:latest").build()))
        .call()
        .chatResponse()
        .getResult()
        .getOutput()
        .getText();

    log.info(text);
}
```

------

### ✅ 实际效果

📂 本地文件已自动创建：

![生成本地文件效果图](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250626154816601.png)

------

## ☁️ 使用 ZhiPu AI 在线模型调用 MCP 工具

[ZhiPu AI](https://www.bigmodel.cn/dev/api/normal-model/glm-4)

本地模型速度较慢？可以切换到 **智谱 AI 在线模型**，实现远程文件管理。

📌 注意：

- 仅智谱 API 支持 MCP 工具协议（国内支持最完善）
- 调用将消耗较多 Token，按需使用

------

### 1️⃣ 引入依赖

```xml

<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-zhipuai-spring-boot-starter</artifactId>
</dependency>
```

------

### 2️⃣ 配置 `application.yml`

```yml
spring:
  ai:
    zhipuai:
      api-key: xxxxxx  # 请替换为你的真实密钥
      chat:
        options:
          model: glm-4-plus
      base-url: https://open.bigmodel.cn/api/paas/
    mcp:
      client:
        stdio:
          servers-configuration: classpath:config/mcp-servers.json
```

------

### 3️⃣ 配置 Bean

```java
@Configuration
public class ZhipuConfig {

    @Bean
    public ZhiPuAiApi zhiPuAiApi(@Value("${spring.ai.zhipuai.base-url}") String baseUrl,
                                  @Value("${spring.ai.zhipuai.api-key}") String apiKey) {
        return new ZhiPuAiApi(baseUrl, apiKey);
    }

    @Bean
    public ChatClient.Builder zhipuChatClientBuilder(ZhiPuAiChatModel zhipuChatModel) {
        return new DefaultChatClientBuilder(
            zhipuChatModel, 
            ObservationRegistry.NOOP, 
            (ChatClientObservationConvention) null
        );
    }
}
```

------

### 4️⃣ 测试 MCP 工具能力

```java
@Resource
private ToolCallbackProvider toolCallback;
@Resource
private ChatClient.Builder zhipuChatClientBuilder;

@Test
public void test2() {
    String res = zhipuChatClientBuilder
        .defaultTools(toolCallback)
        .build()
        .prompt("当前有哪些工具可用")
        .call()
        .chatResponse()
        .getResult()
        .getOutput()
        .getText();

    log.info(res);
}
```

------

### ✅ 效果展示

✨ 可用 MCP 工具一览（自动返回）：

![ZhiPu AI 工具调用效果](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250626155456657.png)

------

## 🔚 总结

| 项目   | Ollama 本地模型  | 智谱 AI 在线模型     |
|------|--------------|----------------|
| 速度   | 较慢           | 快速             |
| 支持模型 | Qwen3（MCP支持） | GLM 系列（MCP支持）  |
| 调用成本 | 免费，需本地资源     | 收费，需 API Token |
| 推荐用途 | 本地开发、私有部署    | 云端调用、便捷测试      |

------

## 自定义 MCP 服务开发指南

为了实现更灵活的 AI 工具接入能力，我们可以自定义一个 MCP 服务模块，用于提供本地能力（例如系统信息、文件操作等）供 AI 调用。

> 官方文档参考：[Spring AI - MCP Server Starter](https://docs.spring.io/spring-ai/reference/api/mcp/mcp-server-boot-starter-docs.html)

------

### 1️⃣ 引入核心依赖

在新建的 Spring Boot 模块中添加以下依赖：

```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-mcp-server-spring-boot-starter</artifactId>
</dependency>
```

------

### 2️⃣ 实现自定义工具类（以获取电脑配置信息为例）

```java
@Service
@Slf4j
public class ComputerService {
    @Tool(description = "获取电脑配置信息")
    public String getComputerInfo(@ToolParam(description = "电脑名称") String computerName) {
        log.info("获取电脑配置信息" + computerName);

        // 操作系统名称
        String osName = System.getProperty("os.name");
        // 操作系统版本
        String osVersion = System.getProperty("os.version");
        // 操作系统架构
        String osArch = System.getProperty("os.arch");
        // 用户的账户名称（注意：Java 本身没有直接获取用户名的方法）
        String userName = System.getProperty("user.name");
        // 用户的主目录
        String userHome = System.getProperty("user.home");
        // 用户的当前工作目录
        String currentDir = System.getProperty("user.dir");
        // Java 运行时环境版本
        String javaVersion = System.getProperty("java.version");
        StringBuilder res = new StringBuilder();
        return res.append("Operating System: ").append(osName).append("\n")
                .append("OS Version: ").append(osVersion).append("\n")
                .append("OS Architecture: ").append(osArch).append("\n")
                .append("User Name: ").append(userName).append("\n")
                .append("User Home: ").append(userHome).append("\n")
                .append("Current Directory: ").append(currentDir).append("\n")
                .append("Java Version: ").append(javaVersion).append("\n").toString();
    }
}
```

------

### 3️⃣ 配置 application.yml

目前提供的标准 MCP 服务类型有以下几种：

- **WebMVC Server Transport**：支持传统的 WebMVC 传输模式，适用于常规 Web 应用。
- **WebMVC Server Transport：Full MCP Server**：支持完整的 MCP 服务功能，集成 `SSE`（Server-Sent Events）传输模式，基于 Spring WebFlux 实现，可以高效地处理实时流数据。
- **WebMVC Server Transport with `STDIO`**：在此模式下，MCP 服务通过标准输入输出（STDIO）方式进行通信，适合命令行工具或无需 Web 服务的场景。

在以下部分，我们将详细说明如何配置和使用 `STDIO` 模式的 MCP 服务，它适用于命令行操作、无界面的后台服务等场景。

为了避免 web 控制台输出，推荐使用 `web-application-type: none`，适合 CLI 工具服务：

```yml
spring:
  application:
    name: mcp-server-computer

  ai:
    mcp:
      server:
        name: ${spring.application.name}
        version: 1.0.0

  main:
    banner-mode: off
    web-application-type: none

logging:
  file:
    name: ${spring.application.name}.log

server:
  servlet:
    encoding:
      charset: UTF-8
      force: true
```

------

### 4️⃣ 启动类与工具注册

```java
@SpringBootApplication
@Slf4j
public class ComputerApplication implements CommandLineRunner {

    public static void main(String[] args) {
        SpringApplication.run(ComputerApplication.class, args);
    }

    @Override
    public void run(String... args) throws Exception {
        log.info("Computer service started");
    }
    // 将当前MCP工具注册到ToolBackProvider中
    @Bean
    public ToolCallbackProvider computerTool(ComputerService computerService) {
        return MethodToolCallbackProvider.builder().toolObjects(computerService).build();
    }
}
```

------

### 5️⃣ 打包服务 Jar 供调用

将该模块 **打包为可执行 Jar**，记录生成的路径（例如：`ai-mcp-server-computer-1.0-SNAPSHOT.jar`）：

> 🧭 例如：`D:\myprojects\Konwledge\xxx\target\ai-mcp-server-computer-1.0-SNAPSHOT.jar`

![打包路径](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250627093509252.png)

------

### 6️⃣ 配置调用方 JSON 文件

在客户端（如 Zhipu AI）中的 `mcp-servers.json` 配置文件中添加如下内容：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx.cmd",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\flycode\\Desktop\\temp"
      ]
    },
    "mcp-server-computer": {
      "command": "java",
      "args": [
        "-jar",
        "D:\\myprojects\\Konwledge\\xxx\\target\\ai-mcp-server-computer-1.0-SNAPSHOT.jar"
      ]
    }
  }
}
```

------

### 7️⃣ 调用测试

使用 `ChatClient` 发起测试请求，查看工具是否注册成功：

```java
@Resource
private ChatClient.Builder zhipuChatClientBuilder;

@Test
public void testToolAvailability() {
    String res = zhipuChatClientBuilder
                    .defaultTools(toolCallback)
                    .build()
                    .prompt("当前有哪些工具可用")
                    .call()
                    .chatResponse()
                    .getResult()
                    .getOutput()
                    .getText();
    log.info(res);
}
```

📸 测试效果如下图所示：

![工具列表显示成功](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250627110127060.png)

------

### 8️⃣ AI 问答调用效果

示例 prompt：调用工具生成电脑配置文件

```java
@Test
public void testComputerTool() {
    String prompt = "获取我的电脑配置信息，帮我生成一个电脑配置.txt文件到C:\\Users\\flycode\\Desktop\\temp位置，并且内容是电脑配置信息";
    String text = zhipuChatClientBuilder
                    .defaultTools(toolCallback)
                    .build()
                    .prompt(new Prompt(prompt))
                    .call()
                    .chatResponse()
                    .getResult()
                    .getOutput()
                    .getText();
    log.info(text);
}
```

最终 AI 成功读取配置信息并创建文件：

![调用效果](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250627110300537.png)

------

### ✅ 小结

通过自定义 MCP Server 模块，你可以让 AI 工具访问本地服务、操作本地资源，支持场景包括但不限于：

- 系统信息读取
- 本地文件生成 / 编辑
- 接入私有 API 或数据库查询

可以将多个服务模块整合，统一注册为 MCP 工具链，提高 AI 调度的灵活性。
