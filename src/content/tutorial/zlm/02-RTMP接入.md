---
title: ZLM 实战 02：RTMP 接入与播放
createTime: '2026/10/26 13:45:00'
code: tzlm-rtmp
permalink: /tutorials/tzlm-rtmp/
summary: 从模拟源出发，解析 RTMP 地址，通过 Python 控制 ZLM 拉流，再在浏览器播放和读取一帧。
order: 2
tags:
  - ZLMediaKit
  - RTMP
  - Python
---

## 定义与地址

RTMP 是基于 TCP 的流媒体传输协议。相机、编码器或 FFmpeg 可主动发布；ZLM 也能从已有 RTMP 服务拉取。推和拉只是连接方向不同。

rtmp://主机:端口/app/stream。默认端口 1935；sim 是应用名，camera 是流名。接入地址和输出地址必须不同，不能让代理指向自己。

## 先启动模拟源

按[准备篇](/tutorials/zlm-setup/)设置环境变量并下载 [zlm_core.py](/examples/zlm-protocols/zlm_core.py)。窗口 A 保持以下命令运行：

```shell
ffmpeg -re -f lavfi -i testsrc2=size=640x360:rate=15 -t 600 -an -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 15 -bf 0 -f flv rtmp://127.0.0.1:1935/sim/camera
```

模拟源由 ZLM 提供本篇所需的 RTMP 输出。真实接入时只替换源 URL，不需要把设备先推到 sim/camera。

## 解析并加载视频

窗口 B 运行：

```shell
python zlm_core.py parse --url rtmp://127.0.0.1:1935/sim/camera
python zlm_core.py inspect --url rtmp://127.0.0.1:1935/sim/camera
python zlm_core.py pull --url rtmp://127.0.0.1:1935/sim/camera --stream rtmp --seconds 180 --output rtmp-frame.ppm
```

parse 只得到 URL 结构；inspect 用 ffprobe 获取实际轨道。pull 向 addStreamProxy 提交来源，目标为 tutorial/rtmp，等待轨道出现后通过目标 RTSP 输出解码一帧，保存 PPM。命令继续保持 180 秒，用于网页观看，最后用返回的代理 key 清理。

本篇不另外实现一个协议解析库。解析压缩码流由 ZLM / FFmpeg 完成，Python 只负责发请求和处理明确的结果：

```text
FFmpeg → RTMP 发布 sim/camera → ZLM 拉取到 tutorial/rtmp → WebRTC → 浏览器
```

RTMP 握手、连接、播放后，ZLM 从消息中提取音视频时间戳、编解码配置和压缩数据，再转协议输出。文件扩展名不是 RTMP 编码信息；本例视频为 H.264，FFmpeg 发布时使用 FLV 封装。

## 在页面上看画面

pull 命令还运行时打开：

```text
http://127.0.0.1:8088/webrtc/?app=tutorial&stream=rtmp&type=play
```

点击播放，确认移动图案持续变化。应为 H.264、640×360、15 fps、无音频。若 API 有轨道但浏览器没画面，检查 WebRTC 的 ICE 地址和端口，不能只重复创建代理。

窗口 C 可独立查询或读取目标：

```shell
python zlm_core.py list --app tutorial --stream rtmp
python zlm_core.py frame --url rtsp://127.0.0.1:8554/tutorial/rtmp --output rtmp-second.ppm
```

## 停止与使用边界

180 秒结束或窗口 B 中 Ctrl+C 会执行 delStreamProxy。再查询 tutorial/rtmp，等待短暂注销后应为空。窗口 A 可继续供其他章节使用；关闭它只停止本模拟源。

若相机已直接推到目标 ZLM 的 sim/camera，就可以直接播放 sim/camera，无需再建拉流代理。本篇创建第二个流名只为演示 RTMP 拉流 API；生产中不要无意义重复拉自己的输出。RTMPS、复杂鉴权及音频兼容不在本篇验证范围。

换输入协议不会自动转码。遇到不兼容编码时，应明确选择 FFmpeg 转码流程，不把“ZLM 接受地址”当成“浏览器支持编码”。

参考：[ZLM API](https://docs.zlmediakit.com/zh/guide/media_server/restful_api.html)、[ZLM 播放 URL](https://docs.zlmediakit.com/zh/guide/media_server/play_url_rules.html)。[返回系列目录](/tutorials/zlm/)。
