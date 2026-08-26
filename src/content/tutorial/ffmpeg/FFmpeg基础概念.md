---
title: FFmpeg基础概念
createTime: '2026/08/26 19:26:32'
code: t1vdqkiht
permalink: /tutorials/t1vdqkiht/
---
# FFmpeg 入门 

官方文档：[FFmpeg Documentation](https://ffmpeg.org/ffmpeg.html)

## 1. FFmpeg 是什么

FFmpeg 是一个通用媒体处理工具，可以读取：

- 视频/音频文件
- RTSP 等网络流
- 摄像头、麦克风等采集设备
- Pipe 管道数据

然后进行：

```text
输入 → 解码/处理/转码 → 输出
```

最终输出为：

- MP4、MKV 等文件
- RTSP、RTMP 等网络流
- 图片、音频
- Pipe 数据

------

## 2. 先区分三个概念

### 容器

用于保存多个媒体流。

常见：

```text
MP4
MKV
FLV
TS
AVI
```

一个 MP4 里面可能同时存在：

```text
MP4
├── H.264 视频流
├── AAC 音频流
└── 字幕流
```

### 视频编码

常见：

```text
H.264 / AVC
H.265 / HEVC
AV1
VP9
```

H.264、H.265 **不是 MP4 这类文件格式，而是视频编码方式**。

### 音频编码

常见：

```text
AAC
MP3
Opus
FLAC
```

------

# 3. 视频数据是怎么产生的

以摄像头为例：

```text
现实画面
   ↓
摄像头传感器
   ↓
原始图像帧
   ↓
H.264 / H.265 编码
   ↓
视频流
   ↓
RTSP / MP4 / TS 等进行传输或保存
```

例如摄像头提供：

```text
rtsp://192.168.1.100/stream
```

里面可能实际传输的是：

```text
RTSP
└── H.265 Video Stream
```

------

# 4. FFmpeg 基本命令

最基础格式：

```bash
ffmpeg -i input.mp4 output.mp4
```

结构：

```text
ffmpeg
 │
 ├── -i input.mp4    输入
 │
 └── output.mp4      输出
```

`-i` 表示指定一个输入。

输入不一定是 MP4。

例如 RTSP：

```bash
ffmpeg -i rtsp://192.168.1.100/stream output.mp4
```

也可以使用图片生成视频：

```bash
ffmpeg -loop 1 -i camera.png -t 3 output.mp4
```

表示将一张图片生成 3 秒视频。

------

# 5. 读取视频信息

本地执行：

```bash
ffmpeg -i ffmpeg_web_preview_audio.mp4
```

即使没有指定输出文件，FFmpeg 仍会读取并分析输入。

最后出现：

```text
At least one output file must be specified
```

属于正常现象，表示：

> 已经读取输入，但是没有指定输出文件。

例如输出：

```text
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'ffmpeg_web_preview_audio.mp4':
  Metadata:
    major_brand     : mp42
    minor_version   : 0
    compatible_brands: isommp42
    creation_time   : 2026-08-26T11:50:18.000000Z
    date            : 2026
  Duration: 00:00:02.73, start: 0.000000, bitrate: 26661 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 2560x1600 [SAR 1:1 DAR 8:5], 26464 kb/s, 59.98 fps, 60 tbr, 90k tbn (default)
      Metadata:
        creation_time   : 2026-08-26T11:50:18.000000Z
        handler_name    : VideoHandle
        vendor_id       : [0][0][0][0]
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 192 kb/s (default)
      Metadata:
        creation_time   : 2026-08-26T11:50:18.000000Z
        handler_name    : SoundHandle
        vendor_id       : [0][0][0][0]
```

重点看：

### Input #0

```text
Input #0
```

表示：

> 第一个输入。

后面的：

```text
mov,mp4,m4a,3gp,3g2,mj2
```

是 FFmpeg 识别到的容器格式族。

------

### Duration

```text
Duration: 00:00:02.73
```

表示媒体时长：

```text
2.73 秒
```

------

### Stream #0:0

```text
Stream #0:0: Video: h264 ...
```

表示：

```text
第一个输入
   ↓
第一个 Stream
   ↓
Video
```

其中：

```text
Video: h264
```

视频编码：

```text
H.264
yuv420p
```

像素格式。

```text
2560x1600
```

分辨率。

```text
26464 kb/s
```

视频码率约：

```text
26.5 Mb/s
59.98 fps
```

每秒约 60 帧。

------

### Stream #0:1

```text
Stream #0:1: Audio: aac (LC)
```

表示：

```text
第一个输入
   ↓
第二个 Stream
   ↓
Audio
```

其中：

```text
AAC
```

是音频编码。

```text
48000 Hz
```

音频采样率。

```text
stereo
```

双声道。

```text
192 kb/s
```

音频码率。

------

# 6. 什么是 Stream

一个：

```text
video.mp4
```

并不等于只有一个“视频”。

它是一个容器，内部可能存在多个 Stream：

```text
video.mp4
│
├── Stream 0 → 视频
├── Stream 1 → 音频
├── Stream 2 → 字幕
└── Stream 3 → 其他数据
```

FFmpeg 官方称这些为：

```text
elementary streams
```

常见类型包括：

```text
Video
Audio
Subtitle
Attachment
Data
```

因此：

```text
MP4    → 容器
H.264  → 视频编码
AAC    → 音频编码
```

这三个概念不能混淆。

------

# 7. Stream #0:0 怎么理解

FFmpeg 的 Input 和 Stream 编号都从 `0` 开始。

例如：

```text
Stream #0:0
        │ │
        │ └── 第一个 Stream
        │
        └──── 第一个 Input
```

第二个 Stream：

```text
Stream #0:1
        │ │
        │ └── 第二个 Stream
        │
        └──── 第一个 Input
```

第二个输入的第一个 Stream：

```text
Stream #1:0
        │ │
        │ └── 第一个 Stream
        │
        └──── 第二个 Input
```

所以：

```text
0:0 → 第一个输入的第一个流
0:1 → 第一个输入的第二个流
1:0 → 第二个输入的第一个流
```

------

# 8. 多个输入

FFmpeg 支持多个输入。

例如：

```bash
ffmpeg \
-i ffmpeg_web_preview_audio.mp4 \
-i audio.aac
```

此时：

```text
Input #0
└── ffmpeg_web_preview_audio.mp4
    ├── Stream #0:0 → Video
    └── Stream #0:1 → Audio

Input #1
└── audio.aac
    └── Stream #1:0 → Audio
```

因此 FFmpeg 当前拥有：

```text
2 个 Input
3 个 Stream
```

------

# 9. 将不同输入组合成一个输出

例如我们希望：

```text
video.mp4 的视频
        +
audio.aac 的声音
        ↓
output.mp4
```

可以：

```bash
ffmpeg -i video.mp4 -i audio.aac -map 0:v:0 -map 1:a:0 output.mp4
```

其中：

```text
-map 0:v:0
```

表示选择：

```text
Input 0
└── 第一个 Video Stream
```

而：

```text
-map 1:a:0
```

表示：

```text
Input 1
└── 第一个 Audio Stream
```

最终：

```text
video.mp4 ── Video ──┐
                     ├── FFmpeg → output.mp4
audio.aac ── Audio ──┘
```

`-map` 后续学习 Stream Selection 时再详细掌握。

------

# 10. 修改输出帧率

例如将输出视频变成 24 FPS：

```bash
ffmpeg -i input.mp4 -r 24 output.mp4
```

这里：

```text
-r 24
```

位于输入文件之后、输出文件之前，因此作用于：

```text
output.mp4
```

流程：

```text
input.mp4
   ↓
FFmpeg
   ↓
24 FPS
   ↓
output.mp4
```

FFmpeg 会通过丢帧或复制帧，使输出达到指定的恒定帧率。

------

## `-r` 放在输入前

也可以看到这种写法：

```bash
ffmpeg -r 20 -i input.xxx output.mp4
```

但它和“输出 20 FPS”不是一回事。

作为输入参数时，`-r` 会忽略输入原来的时间戳，并按照指定帧率重新生成时间戳。

因此普通 MP4 视频学习阶段不要简单理解成：

```text
-r 放前面 = 限制 FFmpeg 每秒读取多少帧
```

对于部分图片序列、采集设备等输入，通常还有专门的：

```text
-framerate
```

参数。

现阶段主要掌握输出帧率即可：

```bash
ffmpeg -i input.mp4 -r 24 output.mp4
```

------

# 11. 参数位置很重要

FFmpeg 参数通常作用于它后面对应的输入或输出。

例如：

```bash
ffmpeg -i input.mp4 -r 24 output.mp4
```

可以理解为：

```text
-i input.mp4
      ↓
     输入

-r 24 output.mp4
      ↓
     输出
```

因此学习 FFmpeg 时不能只记参数，还需要关注：

```text
参数写在哪里
```

------

# 12. 当前阶段需要掌握的内容

完成这一节后，只需要真正记住：

```text
FFmpeg
   ↓
输入 → 处理 → 输出
```

以及：

```text
MP4
└── 容器

H.264 / H.265
└── 视频编码

AAC
└── 音频编码
```

一个媒体文件可以包含多个 Stream：

```text
Input #0
├── Stream #0:0 → Video
└── Stream #0:1 → Audio
```

多个输入则可能变成：

```text
Input #0
├── Stream #0:0
└── Stream #0:1

Input #1
└── Stream #1:0
```

核心编号规则：

```text
输入编号 : Stream编号
```

例如：

```text
0:0
1:0
0:1
```

后续 FFmpeg 的：

```text
-map
-c:v
-c:a
-filter
```

基本都建立在这个概念之上。
