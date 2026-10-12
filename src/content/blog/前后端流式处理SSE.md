---
title: 前后端流式处理SSE
createTime: '2026/03/01 19:23:46'
code: b27sekvrt
permalink: /blog/b27sekvrt/
tags:
  - SSE
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/2f2fb80273762e672c81a240c67f7cda.jpg
---

有限的文本生成任务需要明确的完成事件。下面使用 JSON 包装文本片段，保留空格和换行，收到 done 才确认流正常结束；断线单独显示为错误。

## 可运行的 WebFlux 接口

在 Java 17+、Spring Boot 3.x 的 WebFlux 项目中使用 `spring-boot-starter-webflux`，保存为启动类扫描包下的 `TextStreamController.java`。此例不依赖 AI 服务，先用三段固定文本验证传输。

```java
package example;

import java.time.Duration;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
public class TextStreamController {
    @GetMapping(value = "/text-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<Map<String, String>>> stream() {
        return Flux.just("hello", " ", "world\n")
                .delayElements(Duration.ofMillis(200))
                .map(chunk -> ServerSentEvent.<Map<String, String>>builder(Map.of("d", chunk)).build())
                .concatWith(Mono.just(ServerSentEvent.<Map<String, String>>builder(Map.of("d", ""))
                        .event("done").build()));
    }
}
```

启动后用 `curl.exe -N http://localhost:8080/text-stream` 查看响应，应包含三条 JSON data 和一条 done。`concatWith` 只在上游正常完成后追加 done，上游报错时不会产生这个完成事件。

## 浏览器接收

把下面脚本放在与接口同源的网页中，页面需要 `<pre id="result"></pre>` 和 `<p id="status"></p>`：

```js
const output = document.getElementById('result')
const status = document.getElementById('status')
const source = new EventSource('/text-stream')
let finished = false
source.onmessage = event => {
  try {
    const data = JSON.parse(event.data)
    if (typeof data.d !== 'string') throw new Error('文本片段格式不正确')
    output.textContent += data.d
  } catch (error) {
    source.close()
    status.textContent = error.message
  }
}
source.addEventListener('done', () => {
  finished = true
  source.close()
  status.textContent = '生成完成'
})
source.onerror = () => {
  if (!finished) {
    source.close()
    status.textContent = '连接中断，已接收文本保留，请检查任务状态'
  }
}
window.addEventListener('pagehide', () => source.close())
```

应看到 `hello world`，末尾保留换行。关闭服务器导致的错误不能触发“生成完成”。这里主动关闭错误连接，避免重连重复启动任务；需要恢复时，应把“创建任务”和“订阅已有任务”分开，并设计事件编号和去重。

换成 AI 流时，将 `Flux.just(...)` 替换为自己的 `Flux<String>`。如果 done 还代表文件已保存，就必须把保存过程接入流的完成链；固定等待 1 秒不能保证数据库或文件已经写完。

参考：[Spring WebFlux SSE](https://docs.spring.io/spring-framework/reference/web/webflux/controller/ann-methods/return-types.html)、[SSE 标准](https://html.spec.whatwg.org/multipage/server-sent-events.html)。
