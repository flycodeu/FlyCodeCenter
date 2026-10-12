---
title: SpringBoot调用AI
createTime: '2026/03/01 19:23:46'
code: byd08tp95
permalink: /blog/byd08tp95/
tags:
  - AI
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250506145726.jpg
---

接入模型前先确定服务地址、认证方式和模型 ID。HTTP 请求、厂商 SDK、Spring AI 与 LangChain4j 都可以完成调用，区别在于应用侧的封装方式。

| 方式 | 先确认什么 |
| --- | --- |
| HTTP | URL、请求 JSON、超时与错误响应 |
| 厂商 SDK | SDK 版本及其支持的模型功能 |
| Spring AI | BOM、Starter、模型适配与 Spring Boot 版本 |
| LangChain4j | 模型模块、AI Services、记忆与工具接口 |

先完成 [一次 HTTP 对话](/blog/b1ps0aba0/) 或 [本地 Spring AI 对话](/blog/b2rlufcv7/)。不要同时引入四套调用方式，只为展示同一个接口。

## Spring AI 调用兼容接口

沿用本地教程的 Java 21 / Spring Boot 3.5.16 / Spring AI 1.1.8 项目。调用百炼兼容接口时，将 Ollama Starter 替换为：

```xml
<dependency>
  <groupId>org.springframework.ai</groupId>
  <artifactId>spring-ai-starter-model-openai</artifactId>
</dependency>
```

替换模型配置，ChatClient 调用代码可以保留：

```yaml
spring:
  ai:
    openai:
      base-url: ${MODEL_BASE_URL}
      api-key: ${MODEL_API_KEY}
      chat:
        options:
          model: ${MODEL_ID}
    retry:
      max-attempts: 1
```

在自己的服务端终端设置这三个变量。百炼地域和业务空间影响域名、密钥与模型权限；按 [百炼兼容接口说明](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope) 选择，不能固定复制别人的地域。

这里的 base-url 是服务根地址。例如控制台给出 `https://你的空间.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` 时，本例填写 `https://你的空间.cn-beijing.maas.aliyuncs.com/compatible-mode`，Spring AI 默认补上 `/v1/chat/completions`。如果服务约定了别的路径，则需要配置对应的 completions-path，不能叠出两个 v1。

不要把 API Key 放入前端。调用云模型会传输提示词并可能产生费用，使用自己的账号额度；兼容文本对话不保证同时兼容工具、图片和结构化输出。

## 记忆与输出

历史消息由应用保存并再次发送。模型不会因为连接保持就自动记住每个用户。需要聊天记忆时，为不同用户与会话分配经过服务端授权的标识，并限制历史数量。

模型输出 JSON 仍可能不符合约定。解析后验证字段、范围和枚举；生成代码先作为候选文件检查，不直接执行。框架提供结构化转换，不代表生成内容已通过业务验证。

工具调用见 [Spring AI Tools](/blog/bqmhrqb06/)，另一种 Java 封装见 [LangChain4j 实战](/blog/br6an5kff/)。
