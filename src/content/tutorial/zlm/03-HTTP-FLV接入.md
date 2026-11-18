---
title: ZLM 实战 03：HTTP-FLV 接入与播放
createTime: '2026/10/26 13:45:00'
code: tzlm-flv
permalink: /tutorials/tzlm-flv/
summary: 从模拟源出发，解析 HTTP-FLV 地址，通过 Python 控制 ZLM 拉流，再在浏览器播放和读取一帧。
order: 3
tags:
  - ZLMediaKit
  - HTTP-FLV
  - Python
---

## 定义与地址

FLV 是封装格式；HTTP-FLV 是通过持续的 HTTP 响应发送 FLV 数据。它不是另一个视频编码，也不是 HLV。响应通常不会像普通文件一样很快结束。

http://主机:端口/app/stream.live.flv。ZLM 当前常见播放后缀为 .live.flv，外部服务可能用其他路径。本篇需使用能够直接返回 FLV 数据、且以 .flv 结尾的地址。

## 先启动模拟源

按[准备篇](/tutorials/tzlm-setup/)设置环境变量并下载 [zlm_core.py](/examples/zlm-protocols/zlm_core.py)。窗口 A 保持以下命令运行：

```shell
ffmpeg -re -f lavfi -i testsrc2=size=640x360:rate=15 -t 600 -an -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 15 -bf 0 -f flv rtmp://127.0.0.1:1935/sim/camera
```

模拟源由 ZLM 提供本篇所需的 HTTP-FLV 输出。真实接入时只替换源 URL，不需要把设备先推到 sim/camera。

## 解析并加载视频

窗口 B 运行：

```shell
python zlm_core.py parse --url http://127.0.0.1:8088/sim/camera.live.flv
python zlm_core.py inspect --url http://127.0.0.1:8088/sim/camera.live.flv
python zlm_core.py pull --url http://127.0.0.1:8088/sim/camera.live.flv --stream flv --seconds 180 --output flv-frame.ppm
```

parse 只得到 URL 结构；inspect 用 ffprobe 获取实际轨道。pull 向 addStreamProxy 提交来源，目标为 tutorial/flv，等待轨道出现后通过目标 RTSP 输出解码一帧，保存 PPM。命令继续保持 180 秒，用于网页观看，最后用返回的代理 key 清理。

本篇不另外实现一个协议解析库。解析压缩码流由 ZLM / FFmpeg 完成，Python 只负责发请求和处理明确的结果：

```text
HTTP-FLV 连续响应 → ZLM FLV 解析 → tutorial/flv → WebRTC → 浏览器
```

读取 HTTP 响应后，FLV 解析器处理文件头和音视频 Tag，从中分离配置、时间戳和压缩帧；ZLM 转成浏览器能消费的输出。不要用 response.read() 无限读取直播响应到内存。

## 在页面上看画面

pull 命令还运行时打开：

```text
http://127.0.0.1:8088/webrtc/?app=tutorial&stream=flv&type=play
```

点击播放，确认移动图案持续变化。应为 H.264、640×360、15 fps、无音频。若 API 有轨道但浏览器没画面，检查 WebRTC 的 ICE 地址和端口，不能只重复创建代理。

窗口 C 可独立查询或读取目标：

```shell
python zlm_core.py list --app tutorial --stream flv
python zlm_core.py frame --url rtsp://127.0.0.1:8554/tutorial/flv --output flv-second.ppm
```

## 停止与使用边界

180 秒结束或窗口 B 中 Ctrl+C 会执行 delStreamProxy。再查询 tutorial/flv，等待短暂注销后应为空。窗口 A 可继续供其他章节使用；关闭它只停止本模拟源。

普通 video 标签通常不能直接播放 FLV，需要相应 JS/MSE 播放器或转成 WebRTC。本篇使用 ZLM 自带 WebRTC 页面，不引入第三方播放器依赖。外部源若需要 Cookie、重定向或特定请求头，应先明确访问协议；本例只验证直接可读的本机源。

换输入协议不会自动转码。遇到不兼容编码时，应明确选择 FFmpeg 转码流程，不把“ZLM 接受地址”当成“浏览器支持编码”。

参考：[ZLM API](https://docs.zlmediakit.com/zh/guide/media_server/restful_api.html)、[ZLM 播放 URL](https://docs.zlmediakit.com/zh/guide/media_server/play_url_rules.html)。[返回系列目录](/tutorials/zlm/)。
