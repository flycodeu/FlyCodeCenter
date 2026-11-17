---
title: ZLM 视频流接入实战
createTime: '2026/10/26 13:45:00'
code: tzlm-core
permalink: /tutorials/zlm/
summary: >-
  用 Python 标准库和 FFmpeg 模拟相机，逐个跑通 RTSP、RTMP、HTTP-FLV、HLS、主动 RTSP 与 PS/RTP 的 ZLM
  接入和播放。
order: 3
tags:
  - ZLMediaKit
  - Python
  - 视频流
category: 音视频
showOnHome: false
---

本系列假设已经安装并启动 ZLM，不建设用户系统、设备数据库或业务框架。Python 调管理 API，ZLM 接收和转协议，播放器负责解码显示。示例采用 H.264、640×360、15 fps、无音频的移动测试图，不需要真实相机。

| 顺序 | 文章 | 实际完成的操作 |
| --- | --- | --- |
| 00 | [准备模拟源与 Python 工具](/tutorials/zlm-setup/) | 创建视频源；解析地址、查看轨道、读取一帧 |
| 01 | [RTSP 接入](/tutorials/zlm-rtsp/) | ZLM 拉取 RTSP，转 WebRTC 播放 |
| 02 | [RTMP 接入](/tutorials/zlm-rtmp/) | 区分主动推流与 RTMP 拉流 |
| 03 | [HTTP-FLV 接入](/tutorials/zlm-flv/) | 从连续 HTTP 响应读取 FLV |
| 04 | [HLS 接入](/tutorials/zlm-hls/) | 读取播放列表和 TS 分片 |
| 05 | [主动 RTSP / cRTSP](/tutorials/zlm-crtsp/) | 发布端主动连接 ZLM |
| 06 | [GB28181 与 PS/RTP](/tutorials/zlm-gb28181/) | 说明 SIP 会话，执行 PS/RTP 媒体接收实验 |

每篇都使用 [zlm_core.py](/examples/zlm-protocols/zlm_core.py)。下载后不需要安装 pip 依赖。仅读取地址时不需要 ZLM；读取视频参数和像素需要 ffprobe / FFmpeg。

“解析视频”要区分层次：URL 解析得到主机和端口；媒体解析得到轨道、编码和时间戳；解码得到像素。调用 addStreamProxy 并不等于把 H.265 转成 H.264，返回 code=0 也不代替浏览器首帧验证。

本文系列的 GB 示例验证媒体链，不提供完整 SIP 平台。实际设备的注册鉴权、目录、INVITE 和重连需要信令程序；不能把一个 gb28181:// 字符串直接交给 ZLM 拉流。

旧版综合入门保留在 [ZLMediaKit 入门](/blog/zlmediakit-start/)，安装与总体概念可先看该篇；逐协议代码以本系列为准。
