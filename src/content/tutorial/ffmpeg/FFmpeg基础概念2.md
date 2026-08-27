---
title: FFmpeg基础概念2
createTime: '2026/08/26 21:07:23'
code: t2qx7heah
permalink: /tutorials/t2qx7heah/
---
# FFmpeg 基础概念 2

## 1. FFmpeg 完整处理链路

FFmpeg 的完整处理流程：

```text
文件 / RTSP
    ↓
Demuxer
    ↓
Packet
    ↓
Decoder
    ↓
Frame
    ↓
Filter
    ↓
Frame
    ↓
Encoder
    ↓
Packet
    ↓
Muxer
    ↓
文件 / 网络流
```

核心组件：

| 组件      | 作用                 |
| ------- | ------------------ |
| Demuxer | 解封装，拆出不同 Stream    |
| Packet  | 编码压缩后的数据           |
| Decoder | 将 Packet 解码成 Frame |
| Frame   | 解码后的原始音视频数据        |
| Filter  | 对 Frame 进行处理       |
| Encoder | 将 Frame 编码成 Packet |
| Muxer   | 将多个 Packet 封装成输出   |

可以简单记为：

```text
拆 → 解 → 处理 → 编 → 装
```

---

# 2. Demuxer：解封装

Demuxer 用于从 MP4、MKV、RTSP 等输入中解析出不同的 Stream。

假设：

```text
video.mp4
├── H.264 视频
└── AAC 音频
```

经过 Demuxer：

```text
                        ┌── H.264 Video Packet
video.mp4 → Demuxer ────┤
                        └── AAC Audio Packet
```

执行：

```bash
ffmpeg -i video.mp4
```

可以看到：

```text
Input #0
├── Stream #0:0 → Video
└── Stream #0:1 → Audio
```

通常每个：

```bash
-i
```

对应一个输入，也对应一个 Demuxer 实例。

例如：

```bash
ffmpeg -i video.mp4 -i audio.aac
```

对应：

```text
video.mp4 → Demuxer 0
audio.aac → Demuxer 1
```

---

# 3. Packet：压缩后的数据

Packet 是经过编码压缩的数据。

例如：

```text
MP4
 ↓
Demuxer
 ↓
H.264 Packet
```

此时数据仍然是：

```text
H.264 / H.265 / AAC
```

这类编码后的压缩数据，还不能直接进行像素级图像处理。

---

# 4. Decoder：Packet → Frame

Decoder 用于解码：

```text
Packet
  ↓
Decoder
  ↓
Frame
```

例如：

```text
H.264 Packet
     ↓
H.264 Decoder
     ↓
Video Frame
```

视频 Frame 可以简单理解为：

> 一帧原始图像数据。

音频 Frame 则是一段 PCM 音频采样数据，而不是单独一个音频采样点。

例如 YOLO 推理：

```text
H.264 / H.265 Packet
        ↓
     Decoder
        ↓
      Frame
        ↓
      YOLO
```

YOLO 实际处理的是解码后的图像 Frame，而不是 H.264/H.265 Packet。

---

# 5. Filter：处理 Frame

解码得到 Frame 后，可以进行：

* 缩放
* 裁剪
* 旋转
* 加水印
* 加文字
* 帧率处理
* 图像合成

例如修改分辨率：

```bash
ffmpeg -i input.mp4 -vf scale=1280:720 output.mp4
```

核心流程：

```text
Demuxer
   ↓
H.264 Packet
   ↓
Decoder
   ↓
Frame
   ↓
scale=1280:720
   ↓
Frame
```

Filter 处理的是：

```text
Frame
```

而不是压缩后的 Packet。

---

# 6. Encoder：Frame → Packet

Encoder 和 Decoder 的方向正好相反：

```text
Decoder
Packet → Frame

Encoder
Frame → Packet
```

例如：

```bash
ffmpeg -i input.mp4 -c:v libx264 output.mp4
```

其中：

```text
-c:v libx264
```

表示：

> 视频使用 libx264 编码器编码为 H.264。

流程：

```text
H.264 Packet
     ↓
Decoder
     ↓
Frame
     ↓
libx264 Encoder
     ↓
H.264 Packet
```

注意：

```text
Encoder 输出的是 Packet
```

不是 Frame。

---

# 7. Muxer：封装输出

编码完成以后，可能存在：

```text
H.264 Video Packet
AAC Audio Packet
Subtitle Packet
```

Muxer 将这些数据重新封装：

```text
Video Packet ──┐
               │
Audio Packet ──┼──→ Muxer → output.mp4
               │
Subtitle ──────┘
```

所以可以简单理解：

```text
Demuxer = 拆

Muxer = 装
```

Muxer 最终可以输出到：

```text
MP4
MKV
TS
网络流
Pipe
...
```

---

# 8. 完整转码流程

一个完整的视频处理流程：

```text
input.mp4
    ↓
Demuxer
    ↓
H.264 Packet
    ↓
Decoder
    ↓
Frame
    ↓
Filter
    ↓
Frame
    ↓
Encoder
    ↓
H.264 Packet
    ↓
Muxer
    ↓
output.mp4
```

核心：

```text
Packet → Decoder → Frame → Encoder → Packet
```

---

# 9. Stream Copy：直接复制数据

有时候不需要修改视频内容。

例如：

```text
input.mkv
└── H.264

↓

output.mp4
└── H.264
```

如果只是更换容器，没有必要：

```text
H.264
 ↓
解码
 ↓
Frame
 ↓
重新编码
 ↓
H.264
```

可以直接复制 Packet。

命令：

```bash
ffmpeg -i input.mkv -c copy output.mp4
```

流程：

```text
input.mkv
    ↓
Demuxer
    ↓
H.264 Packet
    ↓
直接复制
    ↓
Muxer
    ↓
output.mp4
```

`-c copy` 表示：

```text
不解码
不重新编码
直接复制 Packet
```

特点：

* 速度快
* CPU/GPU 消耗低
* 不会产生重新编码造成的画质损失

需要注意：

> Stream Copy 只能在目标容器支持原始音视频编码的情况下使用。

例如某些编码无法直接放入 MP4，就不能简单使用 `-c copy`。

---

# 10. 多个输入合并输出

假设存在：

```text
video.mp4
audio.aac
```

希望：

```text
video.mp4 的视频
+
audio.aac 的音频
↓
output.mp4
```

可以执行：

```bash
ffmpeg \
-i video.mp4 \
-i audio.aac \
-map 0:v:0 \
-map 1:a:0 \
-c copy \
output.mp4
```

流程：

```text
video.mp4
    ↓
Demuxer
    ↓
Video Packet ──────┐
                   │
                   ├──→ Muxer → output.mp4
                   │
audio.aac           │
    ↓              │
Demuxer             │
    ↓              │
Audio Packet ───────┘
```

其中：

```text
-map 0:v:0
```

表示：

> 选择 Input 0 的第一个 Video Stream。

```text
-map 1:a:0
```

表示：

> 选择 Input 1 的第一个 Audio Stream。

---

# 11. Transcoding：转码

Transcoding 可以简单理解为：

```text
解码 + 重新编码
```

例如：

```bash
ffmpeg -i video.mp4 -c:v libx264 output.mp4
```

流程：

```text
原始 Packet
    ↓
Decoder
    ↓
Frame
    ↓
Encoder
    ↓
新 Packet
```

以下情况通常需要转码：

* 修改分辨率
* 修改编码格式
* 添加水印
* 裁剪画面
* 使用 Filter
* 目标设备不支持原编码

相比 Stream Copy：

```text
Stream Copy
→ 快、资源占用低

Transcoding
→ 慢、资源消耗高、可以修改媒体内容
```

---

# 12. 视频转码，音频直接复制

例如：

```bash
ffmpeg \
-i INPUT.mkv \
-map 0:v \
-map 0:a \
-c:v libx264 \
-c:a copy \
OUTPUT.mp4
```

其中：

```text
-map 0:v
```

表示：

> 选择 Input 0 中的视频 Stream。

```text
-map 0:a
```

表示：

> 选择 Input 0 中的音频 Stream。

注意：

`-map 0:v` 并不是“只处理视频”，因为后面同时存在：

```text
-map 0:a
```

所以视频和音频都会进入输出。

真正决定处理方式的是：

```text
-c:v libx264
```

视频重新编码。

```text
-c:a copy
```

音频直接复制。

完整流程：

```text
                 ┌─ Video
                 │    ↓
                 │ Decoder
                 │    ↓
                 │  Frame
                 │    ↓
INPUT.mkv ───────┤ libx264
                 │    ↓
                 │ Packet ───────┐
                 │               │
                 └─ Audio        ├──→ Muxer → OUTPUT.mp4
                      ↓          │
                    Copy ────────┘
```

---

# 13. Simple Filter

Simple Filter：

```text
一个输入
   ↓
处理
   ↓
一个输出
```

例如：

```bash
ffmpeg -i input.mp4 -vf scale=1280:720 output.mp4
```

对应：

```text
Frame
 ↓
scale
 ↓
Frame
```

---

# 14. Complex Filter

Complex Filter 用于更加复杂的处理，例如：

* 多个输入
* 多个输出
* 视频叠加
* 视频拼接
* 多路画面合成
* 音频混合

通常使用：

```text
-filter_complex
```

例如两个摄像头拼接：

```text
摄像头 A ──┐
           ├── 拼接 → 一个视频
摄像头 B ──┘
```

再例如 Logo 叠加：

```text
主视频 ────┐
           ├── overlay → 输出视频
Logo ──────┘
```

---

# 15. 三种核心处理模式

## Stream Copy

不解码、不编码：

```text
Demuxer
   ↓
Packet
   ↓
Muxer
```

对应：

```bash
-c copy
```

适合：

```text
换容器
抽取 Stream
合并 Stream
```

---

## Transcoding

重新编码：

```text
Demuxer
   ↓
Packet
   ↓
Decoder
   ↓
Frame
   ↓
Encoder
   ↓
Packet
   ↓
Muxer
```

适合：

```text
H.265 → H.264
修改编码参数
目标设备兼容
```

---

## Filtering

需要修改媒体内容：

```text
Demuxer
   ↓
Packet
   ↓
Decoder
   ↓
Frame
   ↓
Filter
   ↓
Frame
   ↓
Encoder
   ↓
Packet
   ↓
Muxer
```

适合：

```text
缩放
裁剪
水印
旋转
画面合成
```

---

# 16. RTSP 预览转码流程

例如摄像头输出：

```text
H.265
```

但是 Web 端需要：

```text
H.264
```

流程：

```text
RTSP
 ↓
Demuxer
 ↓
H.265 Packet
 ↓
Decoder
 ↓
Frame
 ↓
H.264 Encoder
 ↓
H.264 Packet
 ↓
Muxer
 ↓
Web 播放流
```

核心就是：

```text
H.265 → 解码 → Frame → H.264
```

这属于：

```text
Transcoding
```

---

# 17. YOLO 视频推理流程

算法推理和普通 FFmpeg 转码稍有不同。

输入：

```text
RTSP / MP4
```

首先：

```text
RTSP / MP4
      ↓
Demuxer
      ↓
H.264 / H.265 Packet
      ↓
Decoder
      ↓
Frame
      ↓
YOLO
```

如果只需要：

```text
检测结果
坐标
报警信息
截图
```

到这里就可以结束：

```text
Frame
 ↓
YOLO
 ↓
检测结果
```

如果还需要生成带检测框的视频：

```text
RTSP / MP4
      ↓
Demuxer
      ↓
Packet
      ↓
Decoder
      ↓
Frame
      ↓
YOLO 推理
      ↓
绘制 Box
      ↓
新 Frame
      ↓
Encoder
      ↓
H.264 / H.265 Packet
      ↓
Muxer
      ↓
Web 预览 / 视频文件
```

需要注意：

> YOLO 本身通常输出的是检测结果，例如目标类别、置信度和坐标。

例如：

```text
person
confidence = 0.93
box = [x1, y1, x2, y2]
```

是否生成“带 Box 的新 Frame”，取决于程序有没有把检测结果重新绘制到图像上。

---

# 18. 最终需要理解的核心

整个 FFmpeg 可以浓缩为：

```text
           压缩数据            原始数据
              ↓                   ↓

输入 → Demuxer → Packet → Decoder → Frame
                                      ↓
                                   Filter
                                      ↓
                                    Frame
                                      ↓
输出 ← Muxer ← Packet ← Encoder ──────┘
```

最需要记住两个数据类型：

```text
Packet
= 编码压缩后的数据

Frame
= 解码后的原始数据
```

以及五个组件：

```text
Demuxer → 拆
Decoder → 解
Filter  → 处理
Encoder → 编
Muxer   → 装
```

判断一条 FFmpeg 流程时，可以先问三个问题：

```text
1. 是否需要解码？
2. 是否需要处理 Frame？
3. 是否需要重新编码？
```

如果三个都不需要：

```text
-c copy
```

通常就是效率最高的处理方式。
