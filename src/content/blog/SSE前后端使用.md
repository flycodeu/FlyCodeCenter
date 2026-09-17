---
title: SSE使用
createTime: '2026/03/01 19:23:46'
code: b26kcoq0k
permalink: /blog/b26kcoq0k/
tags:
  - SSE
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/e848b4cad024661c5bb9b6c2d8aefca9.jpg
---

> **SSE（Server-Sent Events）** 是一种基于 HTTP 的服务器向客户端推送数据的技术，适用于实时消息通知、状态更新、日志推送等场景。相比
> WebSocket，SSE 更轻量、简单，且天然支持文本流和自动重连。

## 一、SSE 简介

### 1. 什么是 SSE？

- **SSE（Server-Sent Events）** 是 HTML5 提供的一种浏览器与服务器之间的**单向通信协议**。
- 服务器可以主动向客户端推送数据，客户端通过 `EventSource` API 接收。
- 基于 **HTTP 长连接**，使用 `text/event-stream` 内容类型。

### 2. 适用场景

- 实时通知（如系统告警、订单状态）
- 日志流输出
- 股票行情、数据看板
- 后台任务进度推送

### 3. 与 WebSocket 对比

| 特性     | SSE           | WebSocket   |
|--------|---------------|-------------|
| 协议     | HTTP          | 自定义（ws/wss） |
| 通信方向   | 服务器 → 客户端（单向） | 双向          |
| 复杂度    | 简单            | 较复杂         |
| 自动重连   | 支持            | 需手动实现       |
| 浏览器兼容性 | 良好（除 IE）      | 良好          |
| 适用场景   | 推送为主          | 实时双向交互      |

> ✅ **推荐使用 SSE 的场景：服务器主动推送，客户端仅接收**

## 二、后端实现（Spring Boot）

### 1. 核心依赖

在 Spring MVC 项目中显式引入 Web starter；Spring Boot 本身不会默认包含所有 Web 依赖：

```xml

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

### 2. SSE 服务类：SSEMessageService

```java
@Service
public class SSEMessageService {
    
    private static final Logger logger = LoggerFactory.getLogger(SSEMessageService.class);
    
    // 存储所有SSE连接
    private static final CopyOnWriteArraySet<SseEmitter> emitters = new CopyOnWriteArraySet<>();
    
    /**
     * 创建新的SSE连接
     */
    public SseEmitter createConnection() {
        SseEmitter emitter = new SseEmitter(0L);
        
        emitter.onCompletion(() -> {
            emitters.remove(emitter);
            logger.info("SSE连接完成，当前连接数: {}", emitters.size());
        });
        
        emitter.onTimeout(() -> {
            emitters.remove(emitter);
            logger.info("SSE连接超时，当前连接数: {}", emitters.size());
        });
        
        emitter.onError(throwable -> {
            emitters.remove(emitter);
            logger.error("SSE连接错误: {}, 当前连接数: {}", throwable.getMessage(), emitters.size());
        });
        
        emitters.add(emitter);
        logger.info("新SSE连接建立，当前连接数: {}", emitters.size());
        
        // 发送欢迎消息
        try {
            emitter.send(SseEmitter.event()
                    .name("message")
                    .data("欢迎连接SSE服务器！当前在线人数: " + emitters.size()));
        } catch (IOException e) {
            logger.error("发送欢迎消息失败: {}", e.getMessage());
        }
        
        // 广播新用户连接
        broadcastMessage("新用户已连接，当前在线: " + emitters.size() + " 人");
        
        return emitter;
    }
    
    /**
     * 广播消息给所有连接
     */
    public void broadcastMessage(String message) {
        logger.info("广播消息: {} 给 {} 个客户端", message, emitters.size());
        
        CopyOnWriteArraySet<SseEmitter> deadEmitters = new CopyOnWriteArraySet<>();
        
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("message")
                        .data(message));
            } catch (IOException e) {
                logger.error("发送消息失败: {}", e.getMessage());
                deadEmitters.add(emitter);
            }
        }
        
        // 移除无效连接
        emitters.removeAll(deadEmitters);
    }
    
    /**
     * 获取当前连接数
     */
    public int getConnectionCount() {
        return emitters.size();
    }
}
```

### 3. 控制器（Controller）

```java
@RestController
@RequestMapping("/api/sse")
public class SSEController {

    @Autowired
    private SSEMessageService sseMessageService;

    @GetMapping("/connect")
    public SseEmitter connect() {
        return sseMessageService.createConnection();
    }

    @PostMapping("/broadcast")
    public String broadcast(@RequestBody Map<String, String> request) {
        sseMessageService.broadcastMessage(request.get("message"));
        return "消息已广播";
    }
}
```

## 三、前端使用

### 1. 基础连接

```js
const eventSource = new EventSource('/api/sse/connect');

eventSource.onmessage = function (event) {
    console.log('收到消息:', event.data);
    // 处理消息
};

eventSource.onerror = function (event) {
    console.error('SSE连接出错:', event);
};

```

### 2. 监听自定义事件

后端发送：

```java
emitter.send(SseEmitter.event().name("user-login").data("user123"));
```

前端监听：

```javascript
eventSource.addEventListener('user-login', function (event) {
    console.log('用户登录:', event.data);
});
```

### 3. 自动重连机制

原生 `EventSource` 会在可重试的断线后自动重连。不要同时在 `onerror` 中不断创建新实例，否则旧连接仍可能自行恢复，造成重复连接和重复消息。

```javascript
eventSource.onerror = () => {
    if (eventSource.readyState === EventSource.CONNECTING) {
        console.log('连接中断，等待浏览器重连');
    } else if (eventSource.readyState === EventSource.CLOSED) {
        console.log('连接已关闭');
    }
};
```

需要自行实现指数退避时，应先关闭旧实例，并确保只有一个重连计时器。

### 4. 手动关闭连接

```javascript
if (eventSource) {
   eventSource.close();
}
```

## 四、高级特性

### 1. 心跳机制（Keep-Alive）

可在服务类中定时发送注释心跳；需要启用 Spring 调度，并将代理空闲超时设为大于心跳间隔：

```java
// 每 30 秒发送一次心跳
@Scheduled(fixedRate = 30000)
public void sendHeartbeat() {
    emitters.forEach(emitter -> {
        try {
            emitter.send(SseEmitter.event().comment("heartbeat"));
        } catch (IOException e) {
            emitters.remove(emitter);
            emitter.completeWithError(e);
        }
    });
}
```

### 2. 设置重连建议时间

```java
emitter.send(SseEmitter.event()
    .reconnectTime(5000)  // 建议前端 5 秒后重连
    .name("reconnect")
    .data("服务器建议重连"));
```

前端会自动使用此值作为重连间隔。

### 3. 用户级连接管理（可选）

可按用户维护连接集合，实现定向推送。同一用户多标签页或多设备会产生多个连接，单个 `Map<userId, SseEmitter>` 会覆盖旧连接；用户标识需来自认证上下文。

## 五、注意事项

- **服务重启后连接丢失**
  → 原生 EventSource 会尝试重连；未接收消息的补发仍需服务端实现。
- **连接数限制**
  → 高并发时注意线程和内存消耗，建议设置超时时间（如 new SseEmitter(5 * 60 * 1000L)）。
- **Nginx 配置**
  -> 确保 Nginx 不缓存 SSE 请求：

```nginx
location /api/sse {
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
} 
```

- **浏览器兼容性**
支持：Chrome、Firefox、Safari、Edge
不支持：IE（需 Polyfill）

## 参考

- [WHATWG SSE 标准](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Spring SseEventBuilder](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.SseEventBuilder.html)
