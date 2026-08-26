---
title: FFmpeg 音视频处理教程
createTime: '2026/08/26 13:51:37'
code: tffmpeg01
permalink: /tutorials/ffmpeg/
summary: 从命令行基础开始，掌握媒体探测、转码、抽帧、截图、录制与 RTSP 流处理。
description: 面向工程实践的 FFmpeg 教程，覆盖 ffmpeg、ffprobe、ffplay 的常用命令与视频流处理。
order: 2
tags:
  - tutorial
  - FFmpeg
  - ffprobe
  - 音视频
  - RTSP
  - 转码
category: 音视频
showOnHome: false
---

## 专栏简介

FFmpeg 是一套完整的音视频处理工具链，可用于媒体探测、格式转换、编码压缩、抽帧截图、录制和推拉流。本专栏以实际开发中最常见的任务为主，使用命令行先建立对“输入、解码、处理、编码、输出”这条链路的整体认识。

适合以下场景：

- 摄像机 RTSP 拉流与连通性验证
- 视频转码、封装格式转换和压缩
- 视频抽帧、截图和关键帧留证
- 录像文件截取、拼接和音视频处理
- 为浏览器或流媒体服务准备可播放的视频

## 安装与检查

安装 FFmpeg 后，确保 `ffmpeg`、`ffprobe`、`ffplay` 已加入系统 `PATH`。先检查版本和编解码器是否可用：

```bash
ffmpeg -version
ffprobe -version
ffplay -version
```

Windows、macOS 和 Linux 都可以使用 FFmpeg。生产环境建议固定版本，并记录实际使用的编码器、硬件加速和封装格式，避免开发机与部署机行为不一致。

## 三个常用工具

| 工具 | 作用 | 常见用途 |
| --- | --- | --- |
| `ffmpeg` | 处理和转换音视频 | 转码、截图、抽帧、录制、推流 |
| `ffprobe` | 查看媒体元数据 | 检查时长、分辨率、编码器、帧率 |
| `ffplay` | 快速播放媒体或实时流 | 验证文件、RTSP 地址和延迟表现 |

## 常用命令

### 1. 查看媒体信息

```bash
ffprobe -v error -show_format -show_streams input.mp4
```

只查看适合程序读取的 JSON：

```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
```

### 2. 转换封装格式

当音视频编码本身兼容目标容器时，可以直接复制码流，速度快且不会重复损失画质：

```bash
ffmpeg -i input.mkv -map 0 -c copy output.mp4
```

如果编码不兼容，则需要重新编码：

```bash
ffmpeg -i input.mov -c:v libx264 -c:a aac -movflags +faststart output.mp4
```

### 3. 压缩视频

`CRF` 越小画质越好、文件越大。下面的范围适合先做测试，实际值应结合内容和码率要求调整：

```bash
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k output.mp4
```

### 4. 截图和抽帧

截取指定时间点的一张图片：

```bash
ffmpeg -ss 00:00:10 -i input.mp4 -frames:v 1 -q:v 2 snapshot.jpg
```

按每秒一帧抽取图片：

```bash
ffmpeg -i input.mp4 -vf "fps=1" frames/frame-%05d.jpg
```

### 5. 截取视频片段

以下命令从第 10 秒开始截取 30 秒。`-c copy` 速度快，但切点可能受关键帧影响；需要精确切片时再改为重新编码：

```bash
ffmpeg -ss 00:00:10 -i input.mp4 -t 30 -c copy clip.mp4
```

### 6. 验证 RTSP 实时流

先用 `ffplay` 快速确认地址、账号、密码、网络和码流是否正常：

```bash
ffplay -rtsp_transport tcp "rtsp://user:password@192.168.1.10:554/stream"
```

只验证能否持续读取，不保存输出文件：

```bash
ffmpeg -rtsp_transport tcp -i "rtsp://user:password@192.168.1.10:554/stream" -t 15 -f null -
```

实际项目中建议先用 `ffprobe` 或 `ffmpeg` 验证同一条脱敏后的 RTSP 配置，再继续排查模型、浏览器播放或业务逻辑。

## 常用参数速查

| 参数 | 说明 |
| --- | --- |
| `-i` | 指定输入文件或流地址 |
| `-ss` | 设置开始时间 |
| `-t` | 设置处理时长 |
| `-c:v` / `-c:a` | 指定视频/音频编码器 |
| `-c copy` | 直接复制码流，不重新编码 |
| `-vf` | 设置视频滤镜，如缩放、抽帧 |
| `-r` | 设置输出帧率 |
| `-s` | 设置输出分辨率，如 `1280x720` |
| `-map` | 明确选择输入中的音视频流 |
| `-f` | 指定输出格式，如 `null`、`hls` |
| `-y` | 自动覆盖已有输出文件 |

## 使用注意

- 带用户名、密码或特殊字符的流地址要使用引号；不要把真实凭据提交到仓库或日志。
- `-c copy` 只适合目标容器支持现有编码的情况，遇到无法播放、时间轴异常或封装不兼容时应重新编码。
- RTSP 连接失败要区分网络不可达、鉴权失败、流地址错误、编码不兼容和设备拒绝，不能只根据一行 FFmpeg 日志判断原因。
- 处理大文件或长时间流时，应设置超时、重连、日志级别和输出目录，避免进程无限等待或磁盘被写满。
- 命令中的输入路径、流地址和输出文件名请替换为实际值；示例密码仅用于说明格式。

## 学习路线

1. FFmpeg 基本组成：封装、编码、解码、流和时间戳
2. `ffprobe` 媒体信息读取与问题定位
3. 转码、封装转换、码率和分辨率控制
4. 截图、抽帧、裁剪、拼接与录像文件处理
5. RTSP 拉流、TCP 传输和断流重连
6. HLS、WebRTC、MediaMTX 等流媒体链路
7. 硬件加速、性能调优和生产环境稳定性

后续章节会围绕真实视频流和可复现命令，逐步补充参数解释、故障排查和工程化实现。
