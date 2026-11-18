---
title: ZLM 实战 01：RTSP 接入与播放
createTime: '2026/10/26 13:45:00'
code: tzlm-rtsp
permalink: /tutorials/tzlm-rtsp/
summary: 从模拟源出发，解析 RTSP 地址，通过 Python 控制 ZLM 拉流，再在浏览器播放和读取一帧。
order: 1
tags:
  - ZLMediaKit
  - RTSP
  - Python
---

## 定义与地址

RTSP（Real Time Streaming Protocol）管理播放会话；视频通常通过 RTP 传输。本篇用 RTSP over TCP，把 RTP 数据交错在 TCP 连接中，便于本机实验。

rtsp://主机:端口/媒体路径。默认 RTSP 端口是 554，本教程实例使用 8554。真实相机路径由厂商或 ONVIF GetStreamUri 提供；不能只靠 IP 和品牌猜路径。

## 先启动模拟源

按[准备篇](/tutorials/tzlm-setup/)设置环境变量并下载 [zlm_core.py](/examples/zlm-protocols/zlm_core.py)。窗口 A 保持以下命令运行：

```shell
ffmpeg -re -f lavfi -i testsrc2=size=640x360:rate=15 -t 600 -an -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 15 -bf 0 -f flv rtmp://127.0.0.1:1935/sim/camera
```

模拟源由 ZLM 提供本篇所需的 RTSP 输出。真实接入时只替换源 URL，不需要把设备先推到 sim/camera。

## 解析并加载视频

窗口 B 运行：

```shell
python zlm_core.py parse --url rtsp://127.0.0.1:8554/sim/camera
python zlm_core.py inspect --url rtsp://127.0.0.1:8554/sim/camera
python zlm_core.py pull --url rtsp://127.0.0.1:8554/sim/camera --stream rtsp --seconds 180 --output rtsp-frame.ppm
```

parse 只得到 URL 结构；inspect 用 ffprobe 获取实际轨道。pull 向 addStreamProxy 提交来源，目标为 tutorial/rtsp，等待轨道出现后通过目标 RTSP 输出解码一帧，保存 PPM。命令继续保持 180 秒，用于网页观看，最后用返回的代理 key 清理。

本篇不另外实现一个协议解析库。解析压缩码流由 ZLM / FFmpeg 完成，Python 只负责发请求和处理明确的结果：

```text
模拟相机 → RTSP/TCP → ZLM tutorial/rtsp → WebRTC → 浏览器
```

ZLM 发起 DESCRIBE 取得 SDP，解析轨道和编码描述，再 SETUP、PLAY；收到 RTP 后解析 H.264 数据并生成 WebRTC 等输出。解码为像素在浏览器或 FFmpeg 完成。

## 在页面上看画面

pull 命令还运行时打开：

```text
http://127.0.0.1:8088/webrtc/?app=tutorial&stream=rtsp&type=play
```

点击播放，确认移动图案持续变化。应为 H.264、640×360、15 fps、无音频。若 API 有轨道但浏览器没画面，检查 WebRTC 的 ICE 地址和端口，不能只重复创建代理。

窗口 C 可独立查询或读取目标：

```shell
python zlm_core.py list --app tutorial --stream rtsp
python zlm_core.py frame --url rtsp://127.0.0.1:8554/tutorial/rtsp --output rtsp-second.ppm
```

## 停止与使用边界

180 秒结束或窗口 B 中 Ctrl+C 会执行 delStreamProxy。再查询 tutorial/rtsp，等待短暂注销后应为空。窗口 A 可继续供其他章节使用；关闭它只停止本模拟源。

真实相机的账号密码可包含在 URI userinfo 中，特殊字符需按 URL 规则编码；为避免命令历史保存秘密，使用 SOURCE_URL 环境变量后省略 --url。工具不会回显该地址。此示例固定使用 TCP，不自动回退 UDP。

换输入协议不会自动转码。遇到不兼容编码时，应明确选择 FFmpeg 转码流程，不把“ZLM 接受地址”当成“浏览器支持编码”。

参考：[ZLM API](https://docs.zlmediakit.com/zh/guide/media_server/restful_api.html)、[ZLM 播放 URL](https://docs.zlmediakit.com/zh/guide/media_server/play_url_rules.html)。[返回系列目录](/tutorials/zlm/)。
