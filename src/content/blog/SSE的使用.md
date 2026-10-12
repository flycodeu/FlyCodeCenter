---
title: SSE的使用
createTime: '2026/03/01 19:23:46'
code: b1r8k2otf
permalink: /blog/b1r8k2otf/
tags:
  - SSE
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250603151807.jpg
---

SSE 使用一个 HTTP 响应持续向客户端发送文本事件。浏览器通过 `EventSource` 接收，客户端要提交数据时另发 HTTP 请求。

## 最小消息格式

响应 Content-Type 为 `text/event-stream`，内容使用 UTF-8。一个空行结束一个事件：

```text
id: 1
event: update
data: {"text":"hello"}

```

字段之间不要插空行，否则会变成不同事件。多个 data 行会用换行拼接；注释行以 `:` 开头，可作为心跳。

| 字段 | 作用 |
| --- | --- |
| data | 本次事件的文本内容 |
| event | 事件名，缺省时为 message |
| id | 浏览器记录的位置，重连时可能作为 Last-Event-ID 发送 |
| retry | 建议的重连间隔，单位毫秒 |

## 接收自定义事件

```js
const source = new EventSource('/events')
source.addEventListener('update', event => {
  const data = JSON.parse(event.data)
  console.log(data.text)
})
source.onerror = () => console.log('连接中断或请求失败')
// 页面不再需要连接时调用 source.close()
```

`/events` 必须是自己的 SSE 接口；这段只展示客户端用法。没有 event 字段时使用 onmessage。原生 EventSource 使用 GET，不能直接设置任意 Authorization 请求头或 POST 请求体。

## 连接结束不等于任务完成

原生 EventSource 会对可重试的断线自动重连，没有 onclose 事件。有限任务应发送明确的 done 事件，客户端收到后主动 close；网络错误不能当作 done。

设置 id 不会自动保存或补发旧消息，服务端还要实现事件存储和重放。代理缓冲、压缩缓冲、空闲超时也可能让事件迟迟不显示，应观察浏览器 Network 和实际响应。

与 WebSocket 比较时，区别主要在单向/双向和文本/二进制消息；资源消耗与复杂度取决于具体实现，不能一概判断哪个性能更高。

动手实践：[Spring Boot SSE 广播](/blog/b26kcoq0k/)、[有限流式任务的 done 与错误处理](/blog/b27sekvrt/)、[流式文本的空格与 JSON 编码](/blog/bdz2d2nyh/)。

参考：[WHATWG SSE 标准](https://html.spec.whatwg.org/multipage/server-sent-events.html)。
