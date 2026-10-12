---
title: SpringBoot调用本地AI
createTime: '2026/03/01 19:23:46'
code: b2rlufcv7
permalink: /blog/b2rlufcv7/
tags:
  - AI
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250506145712.jpg
---

下面从一个空 Maven 项目调用本机 Ollama，再把结果显示到网页。代码基线是 Java 21、Spring Boot 3.5.16、Spring AI 1.1.8，避免混用早期 milestone Starter 与新版 API。

## 准备模型

先按 [Ollama Docker 教程](/blog/b2lb91htk/) 启动服务并下载 `llama3.2:1b`。也可安装本机 Ollama，在它的终端执行相同的 pull 命令。模型名必须出现在 `ollama list` 中。

## Maven 项目

创建 `pom.xml`：

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.16</version>
    <relativePath/>
  </parent>
  <groupId>example</groupId><artifactId>local-ai</artifactId><version>1.0.0</version>
  <properties><java.version>21</java.version></properties>
  <dependencyManagement><dependencies>
    <dependency>
      <groupId>org.springframework.ai</groupId><artifactId>spring-ai-bom</artifactId>
      <version>1.1.8</version><type>pom</type><scope>import</scope>
    </dependency>
  </dependencies></dependencyManagement>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-webflux</artifactId></dependency>
    <dependency><groupId>org.springframework.ai</groupId><artifactId>spring-ai-starter-model-ollama</artifactId></dependency>
  </dependencies>
  <build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>
</project>
```

创建 `src/main/resources/application.yaml`：

```yaml
spring:
  ai:
    ollama:
      base-url: http://127.0.0.1:11434
      chat:
        options:
          model: llama3.2:1b
          num-predict: 256
    retry:
      max-attempts: 1
```

`num-predict` 限制本次生成 token 数，不是字符数；`max-attempts` 控制框架重试次数。下载模型与构建依赖需要网络，准备好后推理在本机执行。

## 启动类与接口

`src/main/java/example/DemoApplication.java`：

```java
package example;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

`src/main/java/example/LocalChatController.java`：

```java
package example;

import java.time.Duration;
import java.util.Map;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@RestController
public class LocalChatController {
    private final ChatClient client;
    public LocalChatController(ChatClient.Builder builder) { client = builder.build(); }

    @GetMapping("/chat")
    public Mono<Map<String, String>> chat(@RequestParam String prompt) {
        return Mono.fromCallable(() -> Map.of("answer", client.prompt().user(prompt).call().content()))
                .subscribeOn(Schedulers.boundedElastic()).timeout(Duration.ofSeconds(60));
    }

    @GetMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<Map<String, String>>> stream(@RequestParam String prompt) {
        return client.prompt().user(prompt).stream().content()
                .timeout(Duration.ofSeconds(60))
                .map(text -> ServerSentEvent.<Map<String, String>>builder(Map.of("d", text)).build())
                .concatWith(Mono.just(ServerSentEvent.<Map<String, String>>builder(Map.of("d", ""))
                        .event("done").build()));
    }
}
```

同步模型调用放到 boundedElastic，避免阻塞 WebFlux 事件循环。流式 timeout 是等待下一条信号的超时，不等于整个任务的总时长上限。框架取消订阅后，模型端是否立即停止仍要核对实际服务行为。

## 网页播放文本流

保存 `src/main/resources/static/index.html`：

```html
<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>本地模型练习</title>
<form id="form"><input id="prompt" value="用一句话解释视频转码"><button>发送</button></form>
<pre id="answer"></pre><p id="status"></p>
<script>
const form = document.getElementById('form');
const answer = document.getElementById('answer');
const status = document.getElementById('status');
let active;
form.addEventListener('submit', event => {
  event.preventDefault(); active?.close(); answer.textContent = ''; status.textContent = '生成中';
  const params = new URLSearchParams({prompt: document.getElementById('prompt').value});
  const source = new EventSource('/chat/stream?' + params); active = source;
  source.onmessage = event => {
    if (active !== source) return;
    try { answer.textContent += JSON.parse(event.data).d; }
    catch { source.close(); status.textContent = '响应格式错误'; }
  };
  source.addEventListener('done', () => {
    source.close(); if (active === source) status.textContent = '完成';
  });
  source.onerror = () => {
    source.close(); if (active === source) status.textContent = '连接中断，请检查应用日志';
  };
});
window.addEventListener('pagehide', () => active?.close());
</script></html>
```

使用 textContent 显示结果，避免把模型返回的 HTML 直接当作可信页面执行。

## 自己运行与排查

在项目根目录执行：

```powershell
mvn -version
mvn spring-boot:run
```

确认 Maven 使用 JDK 21，访问 `http://localhost:8080/`，点击发送。先检查 `/chat?prompt=hello` 能否返回 JSON，再检查流式页面。

- 连接拒绝：确认 Ollama 在 11434，应用日志中没有指向容器内部的错误 localhost。
- 模型不存在：核对 `ollama list` 和 yaml 中的模型名。
- 超时：检查模型大小、内存与日志，不直接无限重试。
- 网页没有逐段显示：看 `/chat/stream` 响应和代理缓冲。

这是本机练习接口。给其他用户使用时，还需加入身份校验、请求限额和会话管理。

参考：[Spring AI 1.1.8 Ollama 文档源码](https://github.com/spring-projects/spring-ai/blob/v1.1.8/spring-ai-docs/src/main/antora/modules/ROOT/pages/api/chat/ollama-chat.adoc)、[ChatClient](https://docs.spring.io/spring-ai/reference/1.1/api/chatclient.html)。
