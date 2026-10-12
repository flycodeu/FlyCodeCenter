---
title: WebRtc推送视频流
createTime: '2026/03/01 19:23:46'
code: bnucpsnao
permalink: /blog/bnucpsnao/
tags:
  - 视频流
  - WebRTC
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/6f75f8e2b0df3e00dfd65ad98dfda1ed.jpg
---

这里演示 MediaMTX 1.15.3 将已有媒体流提供给浏览器播放。标题中的“推送”是媒体发布与转发，不表示服务端自动把画面推给所有网页。

## 先准备可播放的媒体源

按 [MediaMTX 接入教程](/blog/b2cajl4xw/) 跑通一条 `tutorial` 流。也可以使用相机 RTSP，但先用 FFprobe 或播放器检查地址和编码。

浏览器不直接播放 RTSP。MediaMTX 转换传输协议，不自动转码；浏览器能否解码仍取决于源流的编码、Profile 和客户端。先使用 H.264 无 B 帧的测试画面排除编码兼容问题。

## 使用内置播放页

在自己的 `mediamtx.yml` 中启用 WebRTC，本机实验配置片段如下，合并到已有配置：

```yaml
webrtc: true
webrtcAddress: 127.0.0.1:8889
webrtcLocalUDPAddress: 127.0.0.1:8189
webrtcAdditionalHosts: [127.0.0.1]
```

重新运行服务，发布到 `tutorial` 路径后打开：

```text
http://127.0.0.1:8889/tutorial
```

路径必须与正在发布或代理的媒体路径一致。页面出现但黑屏时，分别检查源流、WebRTC 连接状态和浏览器解码。

## 嵌入自己的页面

保存 `player.html`：

```html
<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>单路视频预览</title>
<body>
  <iframe src="http://127.0.0.1:8889/tutorial"
          title="tutorial 实时画面" allow="autoplay; fullscreen"
          style="width:100%; max-width:960px; aspect-ratio:16/9; border:0"></iframe>
</body>
</html>
```

在该文件目录运行 `python -m http.server 8091 --bind 127.0.0.1`，打开 `http://127.0.0.1:8091/player.html`。先验证内置播放器，再嵌入页面，便于区分媒体问题与页面问题。

`/tutorial/whep` 是 WHEP 信令端点，需要 SDP 请求，不是浏览器地址栏直接观看的页面。手写播放器还要处理 ICE、会话删除与连接生命周期，可基于该版本的官方 reader.js 实现。

## 换成另一台电脑观看

localhost 指观看者自己的电脑。跨机器访问时，改为服务端可达的 IP，并按实际网络设置监听与 `webrtcAdditionalHosts`。网页信令端口 8889 和媒体候选端口 8189 都要能访问；只代理 HTTP 不保证媒体可达。

公网或复杂 NAT 还可能需要 TURN。HTTPS 页面不要嵌入 HTTP 媒体页，访问认证和证书也要一起配置。不要公开带相机凭据的配置文件。

参考：[浏览器播放与嵌入](https://mediamtx.org/docs/read/web-browsers)、[1.15.3 配置](https://github.com/bluenviron/mediamtx/blob/v1.15.3/mediamtx.yml)。
