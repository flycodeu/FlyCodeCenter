---
title: ZLM 实战 04：HLS 接入与播放
createTime: '2026/10/26 13:45:00'
code: tzlm-hls
permalink: /tutorials/tzlm-hls/
summary: 从模拟源出发，解析 HLS 地址，通过 Python 控制 ZLM 拉流，再在浏览器播放和读取一帧。
order: 4
tags:
  - ZLMediaKit
  - HLS
  - Python
---

## 定义与地址

HLS（HTTP Live Streaming）通过播放列表和分片提供视频。客户端先读取 .m3u8，再逐段请求媒体；直播列表持续更新，因此它不是单个永不结束的 HTTP 响应。

http://主机:端口/app/stream/hls.m3u8。列表中的分片可能是相对路径，需要基于该列表 URL 解析，而不是基于当前工作目录。查询令牌能否沿用由源服务定义，不能随意拼接。

## 先启动模拟源

按[准备篇](/tutorials/tzlm-setup/)设置环境变量并下载 [zlm_core.py](/examples/zlm-protocols/zlm_core.py)。窗口 A 保持以下命令运行：

```shell
ffmpeg -re -f lavfi -i testsrc2=size=640x360:rate=15 -t 600 -an -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 15 -bf 0 -f flv rtmp://127.0.0.1:1935/sim/camera
```

模拟源由 ZLM 提供本篇所需的 HLS 输出。真实接入时只替换源 URL，不需要把设备先推到 sim/camera。等首批 TS 分片生成后再继续。

## 解析并加载视频

窗口 B 运行：

```shell
python zlm_core.py parse --url http://127.0.0.1:8088/sim/camera/hls.m3u8
python zlm_core.py inspect --url http://127.0.0.1:8088/sim/camera/hls.m3u8
python zlm_core.py pull --url http://127.0.0.1:8088/sim/camera/hls.m3u8 --stream hls --seconds 180 --output hls-frame.ppm
```

parse 只得到 URL 结构；inspect 用 ffprobe 获取实际轨道。pull 向 addStreamProxy 提交来源，目标为 tutorial/hls，等待轨道出现后通过目标 RTSP 输出解码一帧，保存 PPM。命令继续保持 180 秒，用于网页观看，最后用返回的代理 key 清理。

本篇不另外实现一个协议解析库。解析压缩码流由 ZLM / FFmpeg 完成，Python 只负责发请求和处理明确的结果：

```text
m3u8 播放列表 → TS 分片 → ZLM → tutorial/hls → WebRTC → 浏览器
```

解析 #EXTM3U、#EXTINF 和媒体序号等信息，取得 TS 分片，解复用 MPEG-TS 得到 H.264 轨道。ZLM 再生成 WebRTC 输出。分片产生、列表刷新和播放器缓冲会增加延迟。

## 在页面上看画面

pull 命令还运行时打开：

```text
http://127.0.0.1:8088/webrtc/?app=tutorial&stream=hls&type=play
```

点击播放，确认移动图案持续变化。应为 H.264、640×360、15 fps、无音频。若 API 有轨道但浏览器没画面，检查 WebRTC 的 ICE 地址和端口，不能只重复创建代理。

窗口 C 可独立查询或读取目标：

```shell
python zlm_core.py list --app tutorial --stream hls
python zlm_core.py frame --url rtsp://127.0.0.1:8554/tutorial/hls --output hls-second.ppm
```

## 停止与使用边界

180 秒结束或窗口 B 中 Ctrl+C 会执行 delStreamProxy。再查询 tutorial/hls，等待短暂注销后应为空。窗口 A 可继续供其他章节使用；关闭它只停止本模拟源。

本篇实测未加密 MPEG-TS HLS。AES 加密、fMP4、主从多码率列表、LL-HLS、跨域鉴权不能从这个结果推导为已经支持。m3u8 返回 200 不代表分片可用或视频能解码；须观察 ZLM 轨道和浏览器动态画面。

换输入协议不会自动转码。遇到不兼容编码时，应明确选择 FFmpeg 转码流程，不把“ZLM 接受地址”当成“浏览器支持编码”。

参考：[ZLM API](https://docs.zlmediakit.com/zh/guide/media_server/restful_api.html)、[ZLM 播放 URL](https://docs.zlmediakit.com/zh/guide/media_server/play_url_rules.html)。[返回系列目录](/tutorials/zlm/)。
