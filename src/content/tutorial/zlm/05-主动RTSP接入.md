---
title: ZLM 实战 05：主动 RTSP 与 cRTSP 接入
createTime: '2026/10/26 13:45:00'
code: tzlm-crtsp
permalink: /tutorials/tzlm-crtsp/
summary: 用 FFmpeg 模拟发布端主动连接 ZLM，理解 RTSP 推流与拉流的方向差异，再在网页播放。
order: 5
tags:
  - ZLMediaKit
  - RTSP
  - Python
---

## cRTSP 在这里指什么

不同产品可能赋予 cRTSP 不同含义。本系列用它表示“相机作为客户端，主动向 ZLM 发布 RTSP”。线路上仍然使用 RTSP，地址仍然是 rtsp://，不是新增 crtsp:// URL 协议。

拉流时 ZLM 连接相机；主动发布时相机连接 ZLM。在相机不能被平台直接访问、但能向 ZLM 建连的环境中，连接方向尤其重要。具体设备是否支持这种发布方式，要看设备能力。

## 创建主动发布模拟源

按[准备篇](/tutorials/tzlm-setup/)配置 ZLM、Python 和 FFmpeg。本篇可独立运行，不必先启动 RTMP 模拟源：

```shell
ffmpeg -re -f lavfi -i testsrc2=size=640x360:rate=15 -t 600 -an -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 15 -bf 0 -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/push/camera
```

目标是 ZLM 的 RTSP 监听端口，push/camera 是本次发布身份。命令只运行 600 秒。已启用 on_publish 鉴权时，需按该实例规则传入令牌；业务系统的命名空间和令牌不是 RTSP 协议本身的要求。

## 怎样接收和解析

发布端发起 ANNOUNCE，提交描述轨道的 SDP，再经 SETUP、RECORD 发送 RTP。ZLM 收到后解析 H.264 压缩数据，注册 push/camera。此时**无需再调用 addStreamProxy 拉同一条流**。

```text
模拟发布端 → RTSP ANNOUNCE / SETUP / RECORD → ZLM → WebRTC → 浏览器
```

Python 查询与读取：

```shell
python zlm_core.py list --app push --stream camera
python zlm_core.py inspect --url rtsp://127.0.0.1:8554/push/camera
python zlm_core.py frame --url rtsp://127.0.0.1:8554/push/camera --output crtsp.ppm
```

查询只读取轨道元数据，frame 才调用 FFmpeg 解码。框架中登记“已知发布地址”只是保存定位关系，不会替相机启动推流。

## 网页播放和停止

打开并点击播放：

```text
http://127.0.0.1:8088/webrtc/?app=push&stream=camera&type=play
```

确认图案连续变化。停止发布 FFmpeg 后，连接断开，ZLM 注销媒体源，页面播放结束。因为本例没有创建代理，所以不要拿 delStreamProxy 关闭发布者，更不要调用全局清流。

若轨道不存在，检查发布端日志、RTSP 端口、鉴权和重名冲突；若轨道存在但网页不播，检查 WebRTC 和编码。主动发布不等于自动设备识别，品牌、序列号、目录仍需独立获取。

参考：[ZLM 推流与播放测试](https://docs.zlmediakit.com/zh/guide/media_server/push_test.html)、[播放地址规则](https://docs.zlmediakit.com/zh/guide/media_server/play_url_rules.html)。[返回目录](/tutorials/zlm/)。
