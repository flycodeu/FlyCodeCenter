---
title: SSE使用
createTime: '2026/03/01 19:23:46'
code: b26kcoq0k
permalink: /blog/b26kcoq0k/
tags:
  - SSE
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/e848b4cad024661c5bb9b6c2d8aefca9.jpg
---

这篇演示 Spring MVC 的持续消息连接。协议格式见 [SSE 基础](/blog/b1r8k2otf/)，有限文本任务和完成事件见 [流式文本](/blog/b27sekvrt/)，避免把三类用途混在同一段代码里。

## 后端发送心跳

已有 Spring Boot 3 MVC 项目添加 Web starter，在启动类扫描范围保存 `HeartbeatController.java`：

```java
package example;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class HeartbeatController {
    private final java.util.Set<SseEmitter> clients = ConcurrentHashMap.newKeySet();
    private final Semaphore slots = new Semaphore(10);

    @Configuration
    @EnableScheduling
    public static class Scheduling {}

    @GetMapping(value = "/api/heartbeat", produces = "text/event-stream")
    public SseEmitter connect() {
        if (!slots.tryAcquire()) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "连接数已达到上限");
        }
        var emitter = new SseEmitter(60_000L);
        clients.add(emitter);
        Runnable remove = () -> {
            if (clients.remove(emitter)) slots.release();
        };
        emitter.onCompletion(remove);
        emitter.onTimeout(() -> { remove.run(); emitter.complete(); });
        emitter.onError(error -> remove.run());
        send(emitter);
        return emitter;
    }

    @Scheduled(fixedDelay = 10_000)
    public void heartbeat() { clients.forEach(this::send); }

    private void send(SseEmitter emitter) {
        try {
            emitter.send(SseEmitter.event().name("heartbeat")
                    .data(java.time.Instant.now().toString()));
        } catch (IOException | IllegalStateException error) {
            if (clients.remove(emitter)) slots.release();
            emitter.completeWithError(error);
        }
    }
}
```

## 浏览器接收

把以下脚本放在同源页面，或打开该服务静态页面的浏览器控制台执行：

```javascript
const source = new EventSource('/api/heartbeat')
source.addEventListener('heartbeat', event => console.log(event.data))
source.onerror = () => console.log('连接中断，浏览器可能重连')
window.addEventListener('pagehide', () => source.close(), { once: true })
// 不再接收时手动执行 source.close()
```

连接最长持续一分钟，之后浏览器可重连；后台集合有十个连接的上限，移除时只释放一次名额。这个例子没有用户广播、事件持久化和断线补发。

SseEmitter 的发送可能阻塞调用线程，写超时和代理空闲超时要按服务器配置检查；集合有界不能替代网络写入超时。生产消息推送还需按认证用户维护连接与权限，不对所有客户端广播私有信息。

反向代理关闭该路径的响应缓冲，保留 SSE Content-Type，空闲超时长于心跳间隔。event id 与 Last-Event-ID 只传递标识，不会替服务端自动保存和补发历史消息。

参考：[Spring SseEmitter](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.html)、[WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)。
