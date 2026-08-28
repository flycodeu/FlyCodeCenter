---
title: FFmpeg Examples
createTime: '2026/08/28 13:31:04'
code: t19hdgc9e
permalink: /tutorials/t19hdgc9e/
---
# FFmpeg 基础概念 5：Examples 实战案例

官方文档：

`https://ffmpeg.org/ffmpeg.html#Examples`

这一章主要不是介绍新的 FFmpeg 核心架构，而是：

> 将前面学习的 Input、Output、Stream、Map、Codec、Filter、Options 组合到实际命令中。

核心目标：

```text
看懂命令
↓
知道每个参数作用
↓
知道数据经过什么流程
↓
能够自己组合 FFmpeg 命令
```

---

# 1. Video and Audio Grabbing

FFmpeg 不只能读取：

```text
MP4
MKV
AAC
RTSP
```

也可以直接读取：

```text
摄像头
麦克风
桌面
采集卡
```

例如 Linux：

```bash
ffmpeg \
-f alsa \
-ac 1 \
-i hw:1 \
-f video4linux2 \
-i /dev/video0 \
output.mpg
```

这里有两个 Input：

```text
Input 0
→ ALSA 麦克风

Input 1
→ Video4Linux2 摄像头
```

最终：

```text
Microphone ── Audio ─┐
                     ├── FFmpeg → output.mpg
Camera ───── Video ──┘
```

其中：

```text
-f alsa
```

表示：

> 指定 Input Format 为 ALSA。

```text
-f video4linux2
```

表示：

> 指定 Input Format 为 Linux V4L2 视频采集设备。

---

## 当前阶段需要掌握什么

不用学习 OSS、ALSA、V4L2 的具体设备配置。

这里只需要理解：

```text
文件
RTSP
摄像头
麦克风
桌面
```

对于 FFmpeg 来说，本质都是：

```text
Input
```

---

# 2. X11 Grabbing：桌面录制

Linux X11 桌面可以直接作为 FFmpeg Input。

例如：

```bash
ffmpeg \
-f x11grab \
-video_size 1280x720 \
-framerate 25 \
-i :0.0 \
output.mpg
```

流程：

```text
Linux Desktop
      ↓
   x11grab
      ↓
    Frame
      ↓
   Encoder
      ↓
 output.mpg
```

其中：

```text
-f x11grab
```

表示：

> 输入是 X11 桌面。

```text
-video_size 1280x720
```

采集区域大小。

```text
-framerate 25
```

采集帧率。

---

## 指定录制区域

例如：

```bash
-i :0.0+10,20
```

可以理解：

```text
X Offset = 10
Y Offset = 20
```

从桌面的：

```text
(10, 20)
```

位置开始采集。

当前如果不做 Linux 桌面录制，这部分了解即可。

---

# 3. 文件格式转换

这是第 6 章最重要的部分。

最基础：

```bash
ffmpeg -i input.mp4 output.mkv
```

流程：

```text
input.mp4
    ↓
Demuxer
    ↓
Stream
    ↓
Decoder / Encoder
    ↓
Muxer
    ↓
output.mkv
```

如果没有：

```bash
-c copy
```

通常会重新编码。

如果：

```bash
ffmpeg -i input.mkv -c copy output.mp4
```

则：

```text
Demuxer
   ↓
Packet
   ↓
Copy
   ↓
Muxer
```

---

# 4. Raw Video

FFmpeg 也可以读取：

```text
Raw Video
```

例如：

```text
YUV
```

Raw Video 和 MP4 不一样。

MP4 中一般包含：

```text
分辨率
编码格式
时间戳
Stream 信息
```

Raw Video 很多信息并不存在。

因此 FFmpeg 可能需要手动指定：

```text
分辨率
像素格式
帧率
```

例如：

```bash
ffmpeg \
-f rawvideo \
-pixel_format yuv420p \
-video_size 1280x720 \
-framerate 25 \
-i input.yuv \
output.mp4
```

可以理解：

```text
Raw YUV
   ↓
告诉 FFmpeg：
1280x720
YUV420P
25 FPS
   ↓
Decoder / Frame
   ↓
Encoder
   ↓
MP4
```

---

# 5. 多 Input 合成一个 Output

例如：

```bash
ffmpeg \
-i audio.wav \
-i video.yuv \
output.mpg
```

输入：

```text
audio.wav
→ Audio

video.yuv
→ Video
```

最终：

```text
Audio ───┐
         ├── Muxer → output.mpg
Video ───┘
```

这和前面学习的：

```text
多个 Input
↓
多个 Stream
↓
一个 Output
```

完全一致。

---

# 6. 音频转换

例如：

```bash
ffmpeg \
-i input.wav \
-ar 22050 \
output.mp2
```

其中：

```text
-ar 22050
```

表示：

> 输出 Audio Sample Rate = 22050 Hz。

完整流程：

```text
WAV
 ↓
Demuxer
 ↓
Audio Packet
 ↓
Decoder
 ↓
Audio Frame
 ↓
Resample
 ↓
Encoder
 ↓
MP2
```

---

# 7. 一个 Input 输出多个文件

这是非常值得学习的场景。

例如：

```bash
ffmpeg \
-i input.wav \
-map 0:a \
-b:a 64k \
output64.mp2 \
-map 0:a \
-b:a 128k \
output128.mp2
```

同一个 Audio Input：

```text
                ┌→ 64k  → output64.mp2
Input Audio ────┤
                └→ 128k → output128.mp2
```

---

## 第一个 Output

```bash
-map 0:a
-b:a 64k
output64.mp2
```

表示：

```text
选择 Input 0 Audio
↓
码率 64k
↓
output64.mp2
```

---

## 第二个 Output

```bash
-map 0:a
-b:a 128k
output128.mp2
```

表示：

```text
选择 Input 0 Audio
↓
码率 128k
↓
output128.mp2
```

所以再次验证：

> Options 通常作用于它后面对应的 Output。

---

# 8. 视频转码

例如：

```bash
ffmpeg \
-i input.vob \
-f avi \
-c:v mpeg4 \
-b:v 800k \
-c:a libmp3lame \
-b:a 128k \
output.avi
```

拆开：

```text
-i input.vob
→ Input

-f avi
→ AVI Muxer

-c:v mpeg4
→ Video 使用 MPEG-4 Encoder

-b:v 800k
→ Video Bitrate 800 kbps

-c:a libmp3lame
→ Audio 使用 MP3 Encoder

-b:a 128k
→ Audio Bitrate 128 kbps
```

流程：

```text
VOB
 ↓
Demuxer
 ↓
Video Packet
 ↓
Decoder
 ↓
Frame
 ↓
MPEG4 Encoder
 ↓
Video Packet
      ┐
      ├→ AVI Muxer → output.avi
      │
Audio Packet
 ↓
Decoder
 ↓
Audio Frame
 ↓
MP3 Encoder
 ↓
Audio Packet
```

这就是典型：

```text
Transcoding
```

---

# 9. 从视频提取图片

这个非常实用。

例如：

```bash
ffmpeg \
-i input.mp4 \
-vf fps=1 \
frame-%03d.jpg
```

表示：

> 每秒提取 1 张图片。

输出：

```text
frame-001.jpg
frame-002.jpg
frame-003.jpg
...
```

流程：

```text
input.mp4
    ↓
Decoder
    ↓
Frame
    ↓
fps=1
    ↓
JPEG Encoder
    ↓
Images
```

---

# 10. `%03d` 是什么

例如：

```text
frame-%03d.jpg
```

`%03d` 表示：

```text
数字编号
长度 3 位
不足前面补 0
```

例如：

```text
1
→ 001

12
→ 012

123
→ 123
```

最终：

```text
frame-001.jpg
frame-002.jpg
frame-003.jpg
```

类似：

```text
%04d
```

则：

```text
0001
0002
0003
```

---

# 11. 从指定位置截图

例如从第 10 秒截取一张：

```bash
ffmpeg \
-ss 10 \
-i input.mp4 \
-frames:v 1 \
screenshot.jpg
```

拆开：

```text
-ss 10
→ Seek 到 10 秒附近

-i input.mp4
→ 输入

-frames:v 1
→ 只输出 1 个 Video Frame
```

流程：

```text
input.mp4
 ↓
Seek 10s
 ↓
Decoder
 ↓
Frame
 ↓
JPEG
 ↓
screenshot.jpg
```

---

# 12. 提取指定时间的视频图片

例如：

```bash
ffmpeg \
-ss 10 \
-i input.mp4 \
-t 5 \
-vf fps=1 \
frame-%03d.jpg
```

表示：

```text
从第 10 秒开始
↓
处理 5 秒
↓
每秒提取 1 张
```

理论上得到大约：

```text
5 张图片
```

---

# 13. 图片生成视频

假设：

```text
frame-001.jpg
frame-002.jpg
frame-003.jpg
...
```

可以：

```bash
ffmpeg \
-framerate 12 \
-i frame-%03d.jpg \
output.mp4
```

流程：

```text
frame-001.jpg
frame-002.jpg
frame-003.jpg
       ↓
 image2 Demuxer
       ↓
     Frame
       ↓
    Encoder
       ↓
   output.mp4
```

---

# 14. `-framerate`

这里：

```bash
-framerate 12
```

表示：

> 将输入图片序列按照每秒 12 张解释。

也就是：

```text
12 Images
=
1 秒 Video
```

例如：

```text
120 张图片
12 FPS
```

最终视频大约：

```text
10 秒
```

---

# 15. 为什么图片输入更推荐 `-framerate`

图片序列本身没有正常的视频 Timestamp。

所以：

```bash
-framerate 12
```

用于告诉 Image Demuxer：

> 这些图片应该按照什么时间间隔进入 FFmpeg。

不要简单使用：

```bash
-r 12 -i ...
```

来代替所有图片序列场景。

---

# 16. Wildcard 图片输入

部分系统可以：

```bash
ffmpeg \
-f image2 \
-pattern_type glob \
-framerate 12 \
-i "frame-*.jpg" \
output.mp4
```

表示匹配：

```text
frame-a.jpg
frame-b.jpg
frame-001.jpg
...
```

但跨平台脚本中：

```text
%03d
```

通常更加明确稳定。

---

# 17. 多 Stream 输出顺序

例如：

```bash
ffmpeg \
-i input1.avi \
-i input2.avi \
-map 1:1 \
-map 1:0 \
-map 0:1 \
-map 0:0 \
-c copy \
output.nut
```

这里：

```text
-map 1:1
-map 1:0
-map 0:1
-map 0:0
```

不仅决定：

> 选择哪些 Stream。

还决定：

> Output Stream 的创建顺序。

输出大致：

```text
Output
├── 来自 Input 1 Stream 1
├── 来自 Input 1 Stream 0
├── 来自 Input 0 Stream 1
└── 来自 Input 0 Stream 0
```

这就是：

```text
-map 顺序
↓
Output Stream 顺序
```

---

# 18. CBR 固定码率

官方提供：

```bash
ffmpeg \
-i input.avi \
-b:v 4000k \
-minrate 4000k \
-maxrate 4000k \
-bufsize 1835k \
output.m2v
```

这里主要涉及：

```text
Rate Control
```

---

## `-b:v`

```bash
-b:v 4000k
```

目标视频码率。

---

## `-minrate`

```bash
-minrate 4000k
```

最低码率。

---

## `-maxrate`

```bash
-maxrate 4000k
```

最高码率。

当：

```text
-b:v
-minrate
-maxrate
```

设置接近一致时，可以约束编码器接近：

```text
CBR
Constant Bit Rate
```

---

## `-bufsize`

```bash
-bufsize
```

属于编码码率控制 Buffer。

会影响：

```text
码率波动
编码器瞬时码率
传输稳定性
```

这部分后面学习：

```text
CBR
VBR
CRF
码率控制
```

时再深入。

---

# 19. 当前阶段不用学习的内容

官方 Examples 里面还有：

```text
lmin
lmax
mblmin
mblmax
QP2LAMBDA
```

这些属于：

```text
Encoder 内部质量控制
```

目前可以直接跳过。

不影响：

```text
文件转换
RTSP
截图
转码
YOLO
推流
```

---

# 20. 本章推荐实践 1：视频截图

准备：

```text
input.mp4
```

执行：

```bash
ffmpeg \
-ss 1 \
-i input.mp4 \
-frames:v 1 \
screenshot.jpg
```

检查：

```text
是否生成 screenshot.jpg
```

理解：

```text
Seek
↓
Decoder
↓
Frame
↓
Image
```

---

# 21. 本章推荐实践 2：每秒抽一帧

```bash
ffmpeg \
-i input.mp4 \
-vf fps=1 \
frame-%03d.jpg
```

例如 3 秒视频：

```text
大约得到：

frame-001.jpg
frame-002.jpg
frame-003.jpg
```

这个实验和算法数据集处理关系很大。

---

# 22. 本章推荐实践 3：图片生成视频

使用上一节生成的：

```text
frame-001.jpg
frame-002.jpg
frame-003.jpg
```

执行：

```bash
ffmpeg \
-framerate 1 \
-i frame-%03d.jpg \
-c:v libx264 \
-pix_fmt yuv420p \
output.mp4
```

流程：

```text
Images
 ↓
Frame
 ↓
libx264
 ↓
H.264 Packet
 ↓
MP4
```

---

# 23. 本章推荐实践 4：两个码率输出

使用之前生成的：

```text
audio.aac
```

例如：

```bash
ffmpeg \
-i audio.aac \
-map 0:a \
-c:a aac \
-b:a 64k \
audio64.aac \
-map 0:a \
-c:a aac \
-b:a 128k \
audio128.aac
```

得到：

```text
audio64.aac
audio128.aac
```

理解：

```text
一个 Input
↓
两个 Output
↓
不同 Output Option
```

---

# 24. 本章推荐实践 5：替换音频

假设：

```text
video.mp4
audio.aac
```

执行：

```bash
ffmpeg \
-i video.mp4 \
-i audio.aac \
-map 0:v:0 \
-map 1:a:0 \
-c:v copy \
-c:a copy \
-shortest \
output.mp4
```

流程：

```text
Input 0 Video ─────┐
                   │
                   ├── Muxer → output.mp4
                   │
Input 1 Audio ─────┘
```

其中：

```text
-shortest
```

表示：

> 最短 Stream 结束后停止输出。

---

# 25. 本章推荐实践 6：Stream Copy

```bash
ffmpeg \
-i input.mkv \
-c copy \
output.mp4
```

观察处理速度。

再执行：

```bash
ffmpeg \
-i input.mkv \
-c:v libx264 \
-c:a aac \
output2.mp4
```

比较：

```text
CPU
速度
耗时
输出大小
```

从实践中理解：

```text
Stream Copy
VS
Transcoding
```

---

# 26. Examples 本质是在复习什么

官方第 6 章实际上把前面所有知识串联了起来：

```text
Input
↓
-i / -f

Stream Selection
↓
-map

Decoder
↓
Frame

Filter
↓
-r / -vf / -af

Encoder
↓
-c:v / -c:a

Encoding Options
↓
-b:v / -b:a / -ar

Muxer
↓
-f / 文件扩展名

Output
```

所以这章不需要背官方示例。

应该做到：

> 看到命令能够拆解。

---

# 27. See Also：FFmpeg 文档体系

官方 `ffmpeg.html` 并不是 FFmpeg 的全部文档。

后续经常需要使用其他手册。

---

## ffmpeg

```text
ffmpeg
```

负责：

```text
媒体处理
转换
转码
推流
截图
```

---

## ffprobe

```text
ffprobe
```

负责：

```text
查看媒体信息
```

例如：

```text
Codec
Resolution
FPS
Bitrate
Duration
Stream
Metadata
```

后续建议重点学习。

---

## ffplay

```text
ffplay
```

简单媒体播放器。

常用于：

```text
快速播放文件
测试 RTSP
测试 Filter
```

例如：

```bash
ffplay rtsp://192.168.1.100/stream
```

---

## ffmpeg-filters

用于查询：

```text
scale
crop
overlay
fps
drawtext
hstack
vstack
...
```

Filter 学习主要查这里。

---

## ffmpeg-codecs

用于：

```text
Codec
Encoder
Decoder
```

例如学习：

```text
H.264
H.265
AAC
```

时使用。

---

## ffmpeg-formats

主要：

```text
Demuxer
Muxer
```

例如：

```text
MP4
MKV
MPEG-TS
```

---

## ffmpeg-protocols

网络协议：

```text
RTSP
HTTP
HTTPS
TCP
UDP
RTP
...
```

对于实时视频非常重要。

---

## ffmpeg-devices

设备：

```text
摄像头
麦克风
桌面采集
采集卡
```

---

## ffmpeg-bitstream-filters

Packet 层处理：

```text
Packet
 ↓
Bitstream Filter
 ↓
Packet
```

不经过：

```text
Decoder
Frame
Encoder
```

以后处理 H.264 / MPEG-TS 时会比较重要。

---

# 28. ffmpeg.html 学习路线完成

到这一章为止，FFmpeg 主文档的核心内容已经基本完成。

当前掌握路线：

```text
Description
↓
Input / Output / Stream

Detailed Description
↓
Demuxer
Decoder
Packet
Frame
Filter
Encoder
Muxer

Stream Selection
↓
Automatic Selection
-map

Options
↓
参数体系
Stream Specifier

Examples
↓
实际组合
```

后续不建议继续单纯背命令。

建议开始进入专题学习：

```text
1. ffprobe

2. Filter

3. H.264 / H.265

4. Timestamp / FPS / GOP

5. RTSP

6. 硬件编解码

7. 实时视频低延迟

8. FFmpeg + YOLO
```

---

# 29. 本章最终需要掌握

真正需要掌握的实际操作：

```text
视频 → 图片

图片 → 视频

一个 Input → 多个 Output

多个 Input → 一个 Output

Stream Copy

Transcoding

Audio Resample

-map 控制 Stream

码率基础
```

最终应该能够看到：

```bash
ffmpeg \
-ss 10 \
-i input.mp4 \
-map 0:v:0 \
-vf fps=1 \
-frames:v 5 \
frame-%03d.jpg
```

直接理解：

```text
input.mp4
↓
从第 10 秒开始
↓
选择第一个 Video
↓
Decoder
↓
Frame
↓
fps=1
↓
取 5 个 Frame
↓
输出 JPEG 图片
```

能够做到这一点，官方 `ffmpeg.html` 主文档的基础部分就已经真正入门。
