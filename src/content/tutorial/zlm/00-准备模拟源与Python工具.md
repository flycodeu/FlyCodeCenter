---
title: ZLM 实战 00：模拟相机与 Python 核心工具
createTime: '2026/10/26 13:45:00'
code: tzlm-setup
permalink: /tutorials/tzlm-setup/
summary: 创建一条有界 H.264 模拟源，用 Python 调用 ZLM，并用 FFmpeg 读取真实 RGB 像素。
order: 0
tags:
  - ZLMediaKit
  - Python
  - FFmpeg
---

## 先准备这三个程序

ZLM 已启动且启用 RTSP、RTMP、HTTP 和 WebRTC；Python 3.11+；FFmpeg 和 ffprobe 在 PATH 中。示例以下端口为约定，**按自己的 ZLM 配置修改**：

| 服务 | 示例端口 | 配置项 |
| --- | --- | --- |
| HTTP / 管理 API | 8088 | http.port |
| RTSP | 8554 | rtsp.port |
| RTMP | 1935 | rtmp.port |
| WebRTC UDP/TCP | 18000 | rtc.port / rtc.tcpPort |

本机学习时使用 127.0.0.1。WebRTC 的 rtc.externIP 应是浏览器能到达的地址。网页能打开但没画面时，还要检查 UDP/TCP 媒体端口；HTTP 端口可达不等于 ICE 可连通。

ZLM 的 protocol.enable_rtsp、enable_rtmp、enable_hls 需为 1；RTSP 演示使用 rtsp.directProxy=0。启用了发布鉴权 hook 的实例还需按自己的规则提供推流凭据；不要为教程关闭业务实例的鉴权。推荐使用单独的本机实验实例。

下载 [zlm_core.py](/examples/zlm-protocols/zlm_core.py) 到一个空目录，后续均在这个目录运行。

PowerShell 7（-MaskInput 为 PowerShell 7 参数）：

```powershell
$env:ZLM_API = 'http://127.0.0.1:8088'
$env:ZLM_SECRET = Read-Host '输入自己 ZLM 的 api.secret' -MaskInput
$env:ZLM_RTSP_PORT = '8554'
python --version
ffmpeg -version
ffprobe -version
```

Linux / Bash：

```bash
export ZLM_API=http://127.0.0.1:8088
read -rs -p 'ZLM api.secret: ' ZLM_SECRET; echo
export ZLM_SECRET
export ZLM_RTSP_PORT=8554
python3 --version
```

Linux 将下面命令的 python 换为 python3。若 FFmpeg 不在 PATH，分别设置 FFMPEG 和 FFPROBE 环境变量为可执行文件绝对路径。密钥只给 Python 服务端程序，不能放进网页 JavaScript。

## 创建模拟相机

窗口 A 执行，保持运行。测试图会移动，600 秒后自动停止，也可 Ctrl+C：

```shell
ffmpeg -re -f lavfi -i testsrc2=size=640x360:rate=15 -t 600 -an -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 15 -bf 0 -f flv rtmp://127.0.0.1:1935/sim/camera
```

-re 按实时速度发送；testsrc2 生成图像；libx264 编码为 H.264；-g 15 每秒一个关键帧；-bf 0 不使用 B 帧；-f flv 指定 RTMP 推送的封装。这里 FFmpeg 是相机替身，ZLM 是接收方。

窗口 B 查询：

```shell
python zlm_core.py list --app sim --stream camera
```

应看到 H264、640、360 等轨道信息。RTSP、RTMP、HLS 等多条 schema 记录是同一源的不同输出，不是创建了多台相机。HLS 需要等待首批分片生成。

源的四种地址：

```text
rtsp://127.0.0.1:8554/sim/camera
rtmp://127.0.0.1:1935/sim/camera
http://127.0.0.1:8088/sim/camera.live.flv
http://127.0.0.1:8088/sim/camera/hls.m3u8
```

## 地址、轨道、像素分别怎么读

```shell
python zlm_core.py parse --url rtsp://127.0.0.1:8554/sim/camera
python zlm_core.py inspect --url rtsp://127.0.0.1:8554/sim/camera
python zlm_core.py frame --url rtsp://127.0.0.1:8554/sim/camera --output frame.ppm
```

parse 使用 urllib.parse.urlsplit，只检查地址结构，不联网；它不输出密码、路径和查询令牌。inspect 调 ffprobe 解析视频轨道。frame 调 FFmpeg 解码、缩放成 640×360 的 RGB24，将标准输出中的 **691200 字节像素**写为 PPM 图像；已存在的文件不会覆盖。

“读取视频帧”的可执行核心就是：

```python
import subprocess

result = subprocess.run([
    "ffmpeg", "-v", "error", "-rtsp_transport", "tcp",
    "-i", "rtsp://127.0.0.1:8554/sim/camera",
    "-an", "-vf", "scale=640:360", "-frames:v", "1",
    "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"
], capture_output=True, timeout=25, check=True)

rgb = result.stdout
assert len(rgb) == 640 * 360 * 3
with open("one-frame.ppm", "xb") as output:
    output.write(b"P6\n640 360\n255\n" + rgb)
```

每个像素依次是 R、G、B。连续读取需要 Popen 和按帧字节数累积读取，不能假定一次 read 恰好返回一帧；本教程只取一帧，避免引入持续解码线程管理。

## 把视频交给 ZLM

核心控制请求是以下调用，完整工具已经封装超时、错误码和清理：

```python
from zlm_core import Zlm

zlm = Zlm()
result = zlm.call(
    "addStreamProxy", vhost="__defaultVhost__", app="tutorial", stream="demo",
    url="rtsp://127.0.0.1:8554/sim/camera",
    rtp_type=0, retry_count=0, timeout_sec=10,
    enable_rtsp=1, enable_rtmp=1, enable_hls=1, enable_mp4=0
)
key = result["data"]["key"]
try:
    rows = zlm.wait("tutorial", "demo")
    print(rows[0]["tracks"])
    input("完成播放后按 Enter 清理")
finally:
    zlm.call("delStreamProxy", key=key)
```

只关闭本次返回 key 对应的代理，不调用全局清流。进程被强杀时 finally 不会执行，需要持久记录 key 并做恢复清理；这属于生产系统的生命周期管理，不是本教学脚本已经实现的能力。

## 网页播放

在代理保持运行时打开：

```text
http://127.0.0.1:8088/webrtc/?app=tutorial&stream=demo&type=play
```

点击 ZLM 自带测试页的播放按钮。发行包需包含 www/webrtc 页面；没有页面时应从与服务端版本匹配的发行包取得，不能把 API JSON 地址直接当播放器。确认画面持续变化才算浏览器播放通过。

RTSP、RTMP 地址不能直接赋值给浏览器 video.src。WebRTC 需要 SDP 信令和 ICE 建连；ZLM 自带页面已包含这些逻辑。[各协议章节](/tutorials/zlm/)复用这条浏览器出口。

## 出错从哪里查

| 现象 | 下一步 |
| --- | --- |
| API 连接拒绝 / 鉴权失败 | 检查 ZLM_API、http.port、api.secret 和 API 访问范围 |
| 没有轨道 | 先查模拟 FFmpeg 是否仍运行、地址是否指向 sim/camera |
| HLS 暂无分片 | 等待若干分片周期，检查 enable_hls 和保存目录 |
| 网页有 UI 但黑屏 | 查编码、WebRTC SDP 响应、ICE 地址和媒体端口 |
| 文件已存在 | 换输出文件名，脚本不会覆盖已有图片 |

示例是本机教学工具，不能原样封装成公开的任意 URL 代理接口。真实应用还需权限、目标网络限制、凭据保护、配额与崩溃恢复。

依据：[ZLM 管理 API](https://docs.zlmediakit.com/zh/guide/media_server/restful_api.html)、[播放地址](https://docs.zlmediakit.com/zh/guide/media_server/play_url_rules.html)、[FFmpeg 处理流程](https://ffmpeg.org/ffmpeg.html#Detailed-description)。
