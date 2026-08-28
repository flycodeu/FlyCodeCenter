---
title: Options参数
createTime: '2026/08/28 11:21:06'
code: t17xaopev
permalink: /tutorials/t17xaopev/
---
# FFmpeg 基础概念 4：Options 参数体系

官方文档：

`https://ffmpeg.org/ffmpeg.html#Options`

---

# 1. Options 是什么

前面已经学习过 FFmpeg 的处理链：

```text
Input
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
Encoder
 ↓
Packet
 ↓
Muxer
 ↓
Output
```

以及：

```text
-map
→ 选择哪些 Stream
```

第 5 章 `Options` 开始解决另一个问题：

> 如何通过参数控制 FFmpeg 的每一个处理环节？

例如：

```bash
ffmpeg -ss 10 -i input.mp4 -t 5 -c:v libx264 -r 30 output.mp4
```

这里存在多个参数：

```text
-ss 10
→ 从第 10 秒开始

-i input.mp4
→ 输入文件

-t 5
→ 输出 5 秒

-c:v libx264
→ 视频使用 libx264 编码

-r 30
→ 输出 30 FPS
```

因此学习 Options 的核心不是背参数，而是理解：

```text
参数是什么？
    ↓
作用于 Input 还是 Output？
    ↓
作用于整个 FFmpeg 还是某个 Stream？
    ↓
应该写在什么位置？
```

---

# 2. 参数的作用范围

FFmpeg 官方文档经常看到：

```text
global
input
output
per-stream
```

需要先理解这些概念。

## Global

作用于整个 FFmpeg 进程。

例如：

```bash
-y
```

表示：

> 输出文件已存在时直接覆盖。

---

## Input

作用于输入。

例如：

```bash
-ss 10 -i input.mp4
```

这里：

```text
-ss 10
```

位于 `-i` 前面，所以是 Input Option。

---

## Output

作用于输出。

例如：

```bash
ffmpeg -i input.mp4 -t 10 output.mp4
```

这里：

```text
-t 10
```

作用于：

```text
output.mp4
```

---

## Per-stream

作用于某一个或某一类 Stream。

例如：

```bash
-c:v libx264
```

只作用于：

```text
Video Stream
```

而：

```bash
-c:a aac
```

只作用于：

```text
Audio Stream
```

所以一个 FFmpeg 命令可以理解为：

```text
Global Options

Input Options
↓
-i Input

Output Options
↓
Output
```

参数位置非常重要。

---

# 3. 数字参数的单位

FFmpeg 数字参数允许添加单位。

例如：

```text
K
M
G
```

常见：

```bash
-b:v 5M
```

表示：

```text
视频码率约 5 Mbit/s
```

还可能看到：

```text
Ki
Mi
Gi
```

其中带 `i` 的形式按照 1024 的二进制倍数解释。

初学阶段知道：

```text
128k
1M
5M
```

这些写法即可。

---

# 4. Boolean 参数

部分参数没有值，本身就是开关。

例如：

```bash
-autorotate
```

表示：

```text
开启自动旋转
```

关闭通常使用：

```bash
-noautorotate
```

类似：

```text
-autoscale
-noautoscale

-stdin
-nostdin
```

可以理解：

```text
-option
→ true

-nooption
→ false
```

但 AVOptions 中部分 Boolean 参数需要：

```text
-option 1
-option 0
```

不能全部套用 `-noxxx`。

---

# 5. Stream Specifier

这是第 5 章最重要的内容之一。

Stream Specifier 用于指定：

> 一个参数究竟作用于哪个 Stream。

例如：

```bash
-c:v libx264
```

其中：

```text
-c
→ Codec 参数

:v
→ Video Stream Specifier
```

所以：

```text
-c:v libx264
```

表示：

> 所有匹配的视频 Stream 使用 libx264。

FFmpeg 官方也说明，Codec、Bitrate 等很多参数都是 Per-stream 参数，需要通过 Stream Specifier 精确指定目标 Stream。

---

# 6. 常见 Stream 类型

常见：

```text
v → Video

V → Video，但不包含封面、缩略图等附属视频

a → Audio

s → Subtitle

d → Data

t → Attachment
```

最常使用：

```text
v
a
s
```

---

# 7. Stream Specifier 基本写法

## 所有视频

```bash
-c:v libx264
```

表示：

```text
所有 Video
↓
libx264
```

---

## 所有音频

```bash
-c:a aac
```

表示：

```text
所有 Audio
↓
AAC
```

---

## 第一个视频

```bash
-c:v:0 libx264
```

表示：

```text
第一个 Video Stream
↓
libx264
```

---

## 第二个音频

```bash
-c:a:1 ac3
```

表示：

```text
第二个 Audio Stream
↓
AC3
```

注意：

```text
编号从 0 开始
```

所以：

```text
a:0 → 第一个 Audio
a:1 → 第二个 Audio
```

---

# 8. Stream Specifier 和 `-map` 的区别

这两个非常容易混淆。

例如：

```bash
-map 0:a:1
```

表示：

> 从 Input 0 中选择第二个 Audio。

属于：

```text
Stream Selection
```

而：

```bash
-c:a:1 aac
```

表示：

> 对输出中的第二个 Audio 使用 AAC Encoder。

属于：

```text
Stream Handling
```

可以记：

```text
-map
→ 输入侧：选谁

-c:a:1
→ 输出侧：怎么处理
```

例如：

```bash
ffmpeg \
-i input.mkv \
-map 0:v:0 \
-map 0:a:0 \
-map 0:a:1 \
-c:v libx264 \
-c:a:0 aac \
-c:a:1 ac3 \
output.mkv
```

流程：

```text
Input
├── Video 0 ─────→ libx264
│
├── Audio 0 ─────→ AAC
│
└── Audio 1 ─────→ AC3
                      ↓
                 output.mkv
```

---

# 9. `-b:a` 也是 Stream Specifier

例如：

```bash
-b:a 128k
```

表示：

```text
所有 Audio
↓
码率 128k
```

如果：

```bash
-b:a:0 128k
```

表示：

```text
第一个 Audio
↓
128k
```

所以以后看到：

```text
-c:v
-c:a
-b:v
-b:a
-r:v
-pix_fmt:v
```

都可以使用同一套理解：

```text
参数 : Stream Specifier
```

---

# 10. Generic Options：通用参数

这类参数主要用于：

```text
查看 FFmpeg 能力
查看帮助
查看版本
日志和调试
```

不是直接处理视频。

官方将这些定义为 FFmpeg 系列工具共享的 Generic Options。

---

# 11. 查看版本

```bash
ffmpeg -version
```

可以看到：

```text
FFmpeg Version
libavcodec
libavformat
libavfilter
...
```

排查环境问题时非常重要。

---

# 12. 查看编译配置

```bash
ffmpeg -buildconf
```

例如可以判断 FFmpeg 是否编译了：

```text
libx264
libx265
nvenc
cuda
...
```

---

# 13. 查看支持的 Encoder

```bash
ffmpeg -encoders
```

例如 Windows 下可以查询：

```bash
ffmpeg -encoders | findstr 264
```

可能看到：

```text
libx264
h264_nvenc
h264_qsv
...
```

分别可能对应：

```text
CPU H.264
NVIDIA GPU H.264
Intel QSV H.264
```

---

# 14. 查看 Decoder

```bash
ffmpeg -decoders
```

例如：

```bash
ffmpeg -decoders | findstr hevc
```

可以检查 H.265 解码支持。

---

# 15. 查看 Codec

```bash
ffmpeg -codecs
```

Codec 和 Encoder / Decoder 不完全相同。

可以先简单理解：

```text
Codec
→ 编码格式

Encoder
→ 把 Frame 编码成该格式的程序

Decoder
→ 把该格式解码成 Frame 的程序
```

例如：

```text
H.264
→ Codec

libx264
→ Encoder

h264_nvenc
→ Encoder
```

---

# 16. 查看 Filter

```bash
ffmpeg -filters
```

可以看到：

```text
scale
overlay
crop
fps
drawtext
...
```

查看单个 Filter：

```bash
ffmpeg -h filter=scale
```

---

# 17. 查看格式

```bash
ffmpeg -formats
```

或者：

```bash
ffmpeg -demuxers
ffmpeg -muxers
```

分别查看：

```text
输入解封装支持
输出封装支持
```

---

# 18. 查看协议

```bash
ffmpeg -protocols
```

可以看到 FFmpeg 支持的：

```text
file
http
https
rtmp
rtp
tcp
udp
...
```

处理 RTSP、HTTP 等网络流时非常有用。

---

# 19. 查看像素格式

```bash
ffmpeg -pix_fmts
```

常见：

```text
yuv420p
yuv422p
yuv444p
nv12
rgb24
...
```

---

# 20. 查看帮助

基础帮助：

```bash
ffmpeg -h
```

完整帮助：

```bash
ffmpeg -h full
```

查看 libx264：

```bash
ffmpeg -h encoder=libx264
```

查看某个 Demuxer：

```bash
ffmpeg -h demuxer=rtsp
```

查看 Filter：

```bash
ffmpeg -h filter=scale
```

这是学习 FFmpeg 很重要的方式：

> 不需要记住所有参数，可以随时查询。

---

# 21. `-loglevel` 日志等级

FFmpeg 默认会输出大量日志。

可以控制：

```bash
-loglevel error
```

只显示 Error。

常见级别：

```text
quiet
fatal
error
warning
info
verbose
debug
trace
```

默认：

```text
info
```

例如：

```bash
ffmpeg -loglevel error -i input.mp4 output.mp4
```

如果排查问题：

```bash
ffmpeg -loglevel debug -i input.mp4 output.mp4
```

---

# 22. `-hide_banner`

FFmpeg 启动时通常会打印：

```text
FFmpeg version
build config
libavcodec
libavformat
...
```

如果不需要：

```bash
-hide_banner
```

例如：

```bash
ffmpeg -hide_banner -i input.mp4
```

输出会更加清爽。

---

# 23. `-report`

发生复杂错误时可以：

```bash
ffmpeg -report -i input.mp4 output.mp4
```

FFmpeg 会把完整命令和日志写到日志文件。

适合：

```text
线上问题排查
转码失败
复杂推流问题
```

---

# 24. AVOptions 是什么

FFmpeg 并不是所有参数都直接由 `ffmpeg` 命令本身定义。

底层还有：

```text
libavformat
libavcodec
libavdevice
```

提供自己的 Options。

这些叫：

```text
AVOptions
```

官方把它们分成：

```text
Generic AVOptions
→ 多种 Codec / Container 都能使用

Private AVOptions
→ 某一个特定 Codec / Container 专用
```

例如 MP3 Muxer：

```bash
-id3v2_version 3
```

就是一个比较具体的 Private Option。

初学阶段：

> 不需要系统学习 AVOptions，遇到具体 Encoder、Decoder、Muxer 时再查。

---

# 25. Main Options

Main Options 是目前最值得掌握的一组。

主要包括：

```text
-f
-i
-y
-n
-c
-t
-to
-ss
-metadata
...
```

---

# 26. `-i`：指定输入

最基础：

```bash
ffmpeg -i input.mp4 output.mp4
```

输入可以是：

```text
文件
RTSP
HTTP
摄像头
Pipe
...
```

例如：

```bash
ffmpeg -i rtsp://192.168.1.10/stream output.mp4
```

---

# 27. `-f`：指定格式

FFmpeg 通常会自动判断 Input 格式，并根据输出扩展名判断 Output 格式。

例如：

```bash
ffmpeg -i input.mkv output.mp4
```

通常不需要：

```bash
-f
```

但部分场景必须手动指定。

例如：

```bash
-f rawvideo
```

因为裸数据本身可能没有足够信息让 FFmpeg 自动判断。

官方也说明，输入通常自动检测、输出通常根据扩展名推断，所以多数普通文件场景无需显式使用 `-f`。

---

# 28. `-y`：自动覆盖

如果：

```text
output.mp4
```

已经存在，FFmpeg 默认会询问：

```text
Overwrite? [y/N]
```

加入：

```bash
-y
```

自动覆盖：

```bash
ffmpeg -y -i input.mp4 output.mp4
```

脚本中非常常用。

---

# 29. `-n`：禁止覆盖

和 `-y` 相反：

```bash
-n
```

如果文件已经存在：

```text
直接退出
```

---

# 30. `-c` / `-codec`

这是非常重要的参数。

```bash
-c:v libx264
```

视频使用：

```text
libx264
```

编码。

```bash
-c:a aac
```

音频使用：

```text
AAC
```

编码。

直接复制：

```bash
-c copy
```

表示所有匹配 Stream：

```text
不 Decoder
不 Encoder
直接复制 Packet
```

例如：

```bash
ffmpeg -i input.mkv -c copy output.mp4
```

---

# 31. `-c:v` 和 `-c:a`

例如：

```bash
ffmpeg \
-i input.mkv \
-c:v libx264 \
-c:a copy \
output.mp4
```

表示：

```text
Video
↓
Decode
↓
Frame
↓
libx264
↓
新 Packet

Audio
↓
Packet Copy
```

官方示例同样使用 `-c:v libx264 -c:a copy` 表示视频转码而音频直接复制。

---

# 32. 最后匹配的 `-c` 生效

例如：

```bash
-c copy -c:v libx264
```

先：

```text
全部 Stream → copy
```

再：

```text
Video → libx264
```

最终：

```text
Video → libx264

Audio → copy

Subtitle → copy
```

这个写法非常实用：

```bash
ffmpeg -i input.mkv \
-map 0 \
-c copy \
-c:v libx264 \
output.mkv
```

意思：

> 默认全部复制，视频例外，需要重新编码。

---

# 33. `-t`：持续时间

例如：

```bash
ffmpeg -i input.mp4 -t 3 output.mp4
```

表示：

```text
输出 3 秒
```

你之前生成 3 秒测试视频就可以使用：

```bash
-t 3
```

---

# 34. `-to`：结束位置

例如：

```bash
ffmpeg -i input.mp4 -to 10 output.mp4
```

表示处理到：

```text
00:00:10
```

需要区分：

```text
-t
→ 持续多久

-to
→ 到什么时间点结束
```

例如：

```text
从 10 秒开始取 5 秒
```

适合：

```bash
-ss 10 -t 5
```

---

# 35. `-ss`：跳转时间

非常常用。

例如：

```bash
ffmpeg -ss 10 -i input.mp4 -t 5 output.mp4
```

表示：

```text
跳到约 10 秒
↓
读取
↓
输出 5 秒
```

但是：

```bash
-ss 10 -i input.mp4
```

和：

```bash
-i input.mp4 -ss 10
```

处理方式不同。

---

# 36. `-ss` 放在 Input 前

```bash
ffmpeg -ss 10 -i input.mp4 output.mp4
```

FFmpeg 会在输入阶段 Seek。

通常：

```text
速度更快
```

因为不需要从头解码到第 10 秒。

---

# 37. `-ss` 放在 Input 后

```bash
ffmpeg -i input.mp4 -ss 10 output.mp4
```

作为 Output Option 时，FFmpeg 会先处理输入，然后丢弃目标时间之前的数据。

可以简单理解：

```text
更偏向处理后的时间裁剪
```

官方对 `-ss` 的 Input / Output 行为做了明确区分。

初学阶段推荐：

```bash
ffmpeg -ss 10 -i input.mp4 -t 5 output.mp4
```

---

# 38. `-sseof`

从视频末尾定位。

例如：

```bash
ffmpeg -sseof -10 -i input.mp4 output.mp4
```

表示：

> 从文件结束前 10 秒附近开始读取。

---

# 39. `-metadata`

设置媒体 Metadata。

例如：

```bash
ffmpeg -i input.mp4 \
-metadata title="测试视频" \
output.mp4
```

给第一个 Audio 设置语言：

```bash
-metadata:s:a:0 language=eng
```

---

# 40. `-disposition`

当存在多个 Audio / Subtitle 时，可以指定默认 Stream。

例如：

```bash
-disposition:a:1 default
```

表示：

> 将第二个 Audio 标记为默认音轨。

这个在：

```text
多语言音轨
多字幕
```

中比较有用。

---

# 41. `-frames`

限制输出 Frame 数量。

例如：

```bash
-frames:v 100
```

表示：

```text
输出 100 个 Video Frame 后停止
```

不推荐继续使用旧的：

```bash
-vframes
```

官方将 `-vframes` 标记为 `-frames:v` 的旧别名。

---

# 42. Video Options

这一部分主要控制：

```text
帧率
分辨率
编码
Filter
像素格式
旋转
```

---

# 43. `-r`：帧率

例如：

```bash
ffmpeg -i input.mp4 -r 24 output.mp4
```

作为 Output Option：

```text
输出目标 = 24 FPS
```

重新编码时 FFmpeg 会根据需要：

```text
复制 Frame
或
丢弃 Frame
```

达到指定帧率。

官方明确说明 Output `-r` 在编码场景下会在编码之前复制或丢弃 Frame，以达到恒定目标 FPS。

---

# 44. Input `-r` 不等于限速读取

例如：

```bash
ffmpeg -r 20 -i input.mp4 output.mp4
```

不能简单理解：

> FFmpeg 每秒只读 20 帧。

Input `-r` 会忽略原时间戳，并根据指定 FPS 重新生成时间戳。

如果是：

```text
图片序列
摄像设备
```

通常还会遇到：

```bash
-framerate
```

官方建议不确定时，不要把 Input `-r` 和 `-framerate` 混用。

---

# 45. `-fpsmax`

限制自动生成的最大输出帧率：

```bash
-fpsmax 30
```

适合一些输入 FPS 被错误识别得很高的场景。

不能和：

```bash
-r
```

同时使用。

---

# 46. `-s`：分辨率

例如：

```bash
ffmpeg -i input.mp4 -s 1280x720 output.mp4
```

实际上 Output `-s` 会在 Filtergraph 后加入一个：

```text
scale
```

所以更加直观的写法通常是：

```bash
-vf scale=1280:720
```

---

# 47. `-aspect`

设置显示宽高比：

```bash
-aspect 16:9
```

需要区分：

```text
Resolution
→ 1920x1080

Aspect Ratio
→ 16:9
```

不是完全相同的概念。

---

# 48. `-vn`

不要 Video：

```bash
ffmpeg -i input.mp4 -vn output.aac
```

表示：

```text
Video ×

Audio ✓
```

---

# 49. `-vcodec`

```bash
-vcodec libx264
```

实际上就是：

```bash
-codec:v libx264
```

也就是：

```bash
-c:v libx264
```

一般推荐使用：

```bash
-c:v
```

更加统一。

---

# 50. `-vf`

Video Filter。

例如：

```bash
ffmpeg -i input.mp4 \
-vf scale=1280:720 \
output.mp4
```

或者：

```bash
-vf "scale=1280:720,fps=15"
```

流程：

```text
Frame
 ↓
scale
 ↓
fps
 ↓
Frame
```

---

# 51. `-pix_fmt`

指定 Pixel Format。

常见：

```bash
-pix_fmt yuv420p
```

网页视频中非常常见。

例如：

```bash
ffmpeg -i input.mp4 \
-c:v libx264 \
-pix_fmt yuv420p \
output.mp4
```

如果不知道 FFmpeg 支持哪些：

```bash
ffmpeg -pix_fmts
```

---

# 52. `-force_key_frames`

用于强制生成关键帧。

例如：

```bash
-force_key_frames "expr:gte(t,n_forced*5)"
```

表示大致：

```text
每 5 秒强制一个关键帧
```

这个参数以后学习：

```text
HLS
实时视频
Seek
GOP
Web 播放
```

时比较重要。

目前知道它的作用即可。

---

# 53. Audio Options

核心音频参数比视频少很多。

目前重点掌握：

```text
-ar
-ac
-an
-c:a
-af
```

官方 Audio Options 就包含采样率、声道数、禁用音频、音频 Codec、Sample Format 和 Filter 等设置。

---

# 54. `-ar`：采样率

例如：

```bash
-ar 44100
```

或者：

```bash
-ar 48000
```

常见：

```text
44100 Hz
48000 Hz
```

---

# 55. `-ac`：声道数

例如：

```bash
-ac 1
```

单声道：

```text
Mono
```

```bash
-ac 2
```

双声道：

```text
Stereo
```

---

# 56. `-an`

不要 Audio：

```bash
ffmpeg -i input.mp4 -an video.mp4
```

结果：

```text
Video ✓
Audio ×
```

---

# 57. `-acodec`

```bash
-acodec aac
```

等价：

```bash
-c:a aac
```

推荐统一使用：

```bash
-c:a
```

---

# 58. `-af`

Audio Filter：

```bash
-af
```

例如调整音量：

```bash
-af "volume=0.5"
```

流程：

```text
Audio Frame
    ↓
 volume
    ↓
Audio Frame
```

---

# 59. Subtitle Options

字幕核心参数：

```text
-c:s
-sn
```

例如：

```bash
-c:s copy
```

字幕直接复制。

```bash
-sn
```

不要字幕。

高级字幕处理暂时不需要深入。

---

# 60. Advanced Options

官方 Advanced Options 非常长。

不是：

> 高级用户必须全部背下来。

而是：

> 很多不同场景的高级能力集中放在这里。

当前阶段重点掌握：

```text
-map
-readrate / -re
-fps_mode
-copyts
-shortest
-bsf
-filter_complex
-thread_queue_size
```

---

# 61. `-map`

前一章已经详细学习。

基本格式：

```bash
-map 0:v:0
```

选择：

```text
Input 0
↓
第一个 Video
```

选择全部：

```bash
-map 0
```

选择：

```text
Input 0 所有 Stream
```

---

# 62. Negative Map

例如：

```bash
-map 0 -map -0:a:1
```

意思：

```text
先选择 Input 0 全部 Stream
↓
再排除第二个 Audio
```

流程：

```text
Input 0
├── Video ✓
├── Audio 0 ✓
├── Audio 1 ×
└── Subtitle ✓
```

官方称这种方式为 Negative Mapping。

---

# 63. Optional Map

例如：

```bash
-map 0:a?
```

最后的：

```text
?
```

表示：

> 如果 Audio 存在就选择，不存在也不要报错。

例如脚本批量处理：

```bash
ffmpeg \
-i input.mp4 \
-map 0:v \
-map 0:a? \
output.mp4
```

有的输入没声音也可以继续执行。

这个非常实用。

---

# 64. Metadata Map

```bash
-map_metadata
```

控制 Metadata 从哪里复制。

普通视频处理中不常用。

例如：

```bash
-map_metadata 0
```

可以用于复制 Input 0 的 Metadata。

---

# 65. `-re` / `-readrate`

这是实时推流很重要的参数。

普通文件：

```text
3 秒视频
```

FFmpeg 可能几十毫秒就读完。

但是推流时通常希望：

```text
按照视频真实时间发送
```

可以：

```bash
-re
```

例如：

```bash
ffmpeg \
-re \
-i input.mp4 \
-f rtsp \
rtsp://127.0.0.1/live
```

官方定义：

```text
-re
=
-readrate 1
```

即按照接近媒体原生时间速度读取。

注意：

> 对本来就是真实实时输入的摄像头/直播流，不应该随便再降低读取速度。

---

# 66. `-fps_mode`

控制输出 Frame 与时间戳的关系。

主要模式：

```text
passthrough
cfr
vfr
auto
```

## CFR

```text
Constant Frame Rate
```

FFmpeg 会复制或丢弃 Frame：

```text
确保恒定 FPS
```

---

## VFR

```text
Variable Frame Rate
```

允许：

```text
可变帧率
```

---

## passthrough

尽量保留：

```text
原始 Frame Timestamp
```

---

## auto

根据 Muxer 自动选择。

默认通常使用：

```text
auto
```

---

# 67. `-copyts`

表示：

> 尽量保留输入原始 Timestamp。

例如：

```bash
-copyts
```

实时视频、MPEG-TS、多流同步等场景会遇到。

初学阶段不要主动乱加。

---

# 68. `-start_at_zero`

通常配合：

```bash
-copyts
```

使用。

作用：

> 保留 Timestamp 关系，但整体移动到从 0 开始。

---

# 69. `-shortest`

当输出有多个 Stream：

```text
Video 10 秒
Audio 8 秒
```

使用：

```bash
-shortest
```

则：

```text
8 秒时停止
```

也就是：

> 最短的 Stream 结束时停止整个输出。

官方也提醒它在某些稀疏 Stream 场景可能需要缓存，从而增加延迟。

---

# 70. Bitstream Filter

参数：

```bash
-bsf
```

Bitstream Filter 和普通 Filter 不一样。

普通：

```text
Packet
 ↓
Decoder
 ↓
Frame
 ↓
Filter
```

而 Bitstream Filter：

```text
Packet
 ↓
BSF
 ↓
Packet
```

也就是说：

> 不需要解码成 Frame。

例如：

```bash
-bsf:v h264_mp4toannexb
```

可以转换 H.264 的 Bitstream 封装形式。

官方示例甚至可以配合：

```bash
-c:v copy
```

工作，因为它处理的是 Packet，而不是 Frame。

这个概念以后处理：

```text
H.264
MPEG-TS
RTSP
Annex B
```

非常重要。

---

# 71. `-filter_complex`

之前已经学习过。

Simple：

```bash
-vf
```

通常：

```text
一个输入
↓
Filter
↓
一个输出
```

Complex：

```bash
-filter_complex
```

支持：

```text
多个输入
多个输出
复杂连接
```

例如：

```bash
ffmpeg \
-i video.mp4 \
-i logo.png \
-filter_complex "[0:v][1:v]overlay[out]" \
-map "[out]" \
output.mp4
```

流程：

```text
Video ─────┐
           ├→ overlay → [out] → output.mp4
Logo ──────┘
```

其中：

```text
[0:v]
→ 第一个 Input 的 Video

[1:v]
→ 第二个 Input 的 Video

[out]
→ Filter 输出 Label
```

官方也明确说明 `filter_complex` 的输入可以通过 `[file_index:stream_specifier]` 指定，带 Label 的输出通过 `-map` 使用；未命名输出则自动加入第一个 Output。

---

# 72. `-thread_queue_size`

这个参数和实时视频关系比较大。

例如：

```bash
-thread_queue_size 512
```

用于控制：

```text
输入 Packet Queue
```

对于：

```text
高码率实时流
多 Input
采集设备
```

如果程序不能及时读取 Packet，Queue 太小可能导致：

```text
Packet 被丢弃
```

以后处理多路实时视频时会遇到。

---

# 73. `-discard`

允许在输入侧丢弃某些 Stream 或 Frame。

例如：

```text
nokey
```

可以表示只保留 Keyframe 等行为。

属于高级优化功能。

现阶段知道存在即可。

---

# 74. `-xerror`

正常 FFmpeg 有些错误可能会继续运行。

加入：

```bash
-xerror
```

表示：

> 遇到错误直接退出。

服务端自动任务中有时比较有用。

---

# 75. `-benchmark`

测试 FFmpeg 性能：

```bash
-benchmark
```

运行完成后输出：

```text
Real Time
System Time
User Time
Memory
```

以后测试：

```text
CPU 编码
GPU 编码
不同 Decoder
```

性能时比较有用。

---

# 76. Preset Files

FFmpeg 支持把很多 Options 保存到 Preset 文件。

本质：

```text
option=value
option=value
option=value
```

用于避免命令行写得特别长。

官方第 5.12 节主要介绍：

```text
ffpreset
avpreset
```

两类 Preset 文件。

当前阶段：

> 知道存在即可，不需要学习。

现在更常见的是编码器自己的：

```text
-preset
```

例如：

```bash
-c:v libx264 -preset fast
```

但这属于对应 Encoder 的参数，需要结合具体 Encoder 学习。

---

# 77. vstats

FFmpeg 可以输出视频编码统计：

```bash
-vstats
```

或者：

```bash
-vstats_file stats.log
```

用于查看：

```text
Frame
Bitrate
Size
Timestamp
...
```

官方第 5.13 节专门定义了 vstats 文件格式。

普通视频转换基本不需要。

性能分析时再学习。

---

# 78. 第五章不要全部背

官方第 5 章非常长，但核心结构可以整理为：

```text
Options
│
├── Stream Specifier
│   └── 参数作用于哪个 Stream
│
├── Generic Options
│   └── 查询、帮助、日志
│
├── AVOptions
│   └── Codec / Container 专属参数
│
├── Main Options
│   └── 输入、输出、编码、时间
│
├── Video Options
│   └── FPS、分辨率、Video Filter
│
├── Audio Options
│   └── Sample Rate、Channel、Audio Filter
│
├── Subtitle Options
│
├── Advanced Options
│   └── Map、Timestamp、实时流、Complex Filter
│
├── Preset
│
└── Stats
```

---

# 79. 当前阶段必须掌握的参数

第一优先级：

```text
-i
-map
-c:v
-c:a
-c copy

-ss
-t
-y

-r
-vf
-pix_fmt

-an
-vn
```

第二优先级：

```text
-f
-to
-s

-ar
-ac
-af

-filter_complex
-re
-shortest
```

第三优先级：

```text
-loglevel
-report
-fps_mode
-copyts
-bsf
-thread_queue_size
-benchmark
```

剩下参数：

> 遇到实际需求再查询。

---

# 80. 一条完整命令怎么分析

例如：

```bash
ffmpeg \
-y \
-ss 10 \
-i input.mp4 \
-map 0:v:0 \
-map 0:a:0 \
-t 5 \
-c:v libx264 \
-r 30 \
-pix_fmt yuv420p \
-c:a aac \
output.mp4
```

不要一次理解。

按照顺序拆。

---

## Step 1：Global

```bash
-y
```

输出存在：

```text
直接覆盖
```

---

## Step 2：Input

```bash
-ss 10
-i input.mp4
```

表示：

```text
从 Input 大约 10 秒处开始
```

---

## Step 3：Stream Selection

```bash
-map 0:v:0
-map 0:a:0
```

选择：

```text
第一个 Video
第一个 Audio
```

---

## Step 4：Output Duration

```bash
-t 5
```

输出：

```text
5 秒
```

---

## Step 5：Video Handling

```bash
-c:v libx264
-r 30
-pix_fmt yuv420p
```

表示：

```text
Video
 ↓
libx264
 ↓
30 FPS
 ↓
yuv420p
```

---

## Step 6：Audio Handling

```bash
-c:a aac
```

Audio：

```text
重新编码 AAC
```

---

## Step 7：Muxer

```text
output.mp4
```

根据：

```text
.mp4
```

选择 MP4 Muxer。

所以完整流程：

```text
input.mp4
    ↓
从 10 秒开始
    ↓
Demuxer
    ↓
选择 Video + Audio
    ↓
Video Decoder
    ↓
Frame
    ↓
30 FPS
    ↓
libx264
    ↓
H.264 Packet
    │
    │
Audio Decoder
    ↓
Audio Frame
    ↓
AAC Encoder
    ↓
AAC Packet
    │
    └────────────┐
                 ↓
               Muxer
                 ↓
           output.mp4
                 ↓
               5 秒
```

---

# 81. RTSP 场景怎么套用 Options

例如：

```bash
ffmpeg \
-i rtsp://192.168.1.100/stream \
-map 0:v:0 \
-an \
-c:v libx264 \
-r 15 \
-f mp4 \
output.mp4
```

拆：

```text
-i RTSP
→ 输入 RTSP

-map 0:v:0
→ 第一个 Video

-an
→ 不要 Audio

-c:v libx264
→ 转 H.264

-r 15
→ 输出 15 FPS

-f mp4
→ MP4 Muxer
```

流程：

```text
RTSP
 ↓
Demuxer
 ↓
Video Packet
 ↓
Decoder
 ↓
Frame
 ↓
15 FPS
 ↓
libx264
 ↓
H.264 Packet
 ↓
MP4 Muxer
 ↓
output.mp4
```

---

# 82. Stream Copy 场景

```bash
ffmpeg \
-i input.mkv \
-map 0:v:0 \
-map 0:a:0 \
-c copy \
output.mp4
```

Options：

```text
-i
→ 输入

-map
→ 选择 Video + Audio

-c copy
→ 都不重新编码

output.mp4
→ MP4 Muxer
```

流程：

```text
Input
 ↓
Demuxer
 ↓
Packet
 ↓
-map
 ↓
Packet Copy
 ↓
Muxer
 ↓
Output
```

不存在：

```text
Decoder
Frame
Encoder
```

---

# 83. 最终总结

学习 FFmpeg Options 时，不要看到：

```bash
-c:v
-map
-r
-pix_fmt
-ss
-t
```

就逐个死记。

应该始终问：

```text
这个参数作用在哪？
```

首先判断：

```text
Global？
Input？
Output？
Per-stream？
```

如果是 Per-stream，再判断：

```text
Video？
Audio？
Subtitle？
第几个 Stream？
```

最终可以把 FFmpeg 命令理解成：

```text
Global Options
      ↓
Input Options
      ↓
-i Input
      ↓
Stream Selection
      ↓
-map
      ↓
Decoder / Filter
      ↓
Output Stream Options
      ↓
-c / -r / -pix_fmt / ...
      ↓
Muxer
      ↓
Output
```

第 5 章真正要建立的是：

> **知道一个 Option 在整条 FFmpeg Pipeline 中控制的是哪一个位置。**

而不是：

> **背完 FFmpeg 的全部参数。**
