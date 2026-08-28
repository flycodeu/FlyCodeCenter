---
title: StreamSelection基础概念
createTime: '2026/08/27 15:50:36'
code: t6loukxpw
permalink: /tutorials/t6loukxpw/
---
# FFmpeg 基础概念 3：Stream Selection

## 1. 什么是 Stream Selection

一个输入文件中可能存在多个 Stream：

```text
input.mp4
├── Stream #0:0 → Video
├── Stream #0:1 → Audio
└── Stream #0:2 → Subtitle
```

当 FFmpeg 生成输出文件时，需要先决定：

> 输入中的哪些 Stream 要放到输出文件中？

这个过程叫：

```text
Stream Selection
```

有两种选择方式：

```text
Automatic Stream Selection
→ FFmpeg 自动选择

Manual Stream Selection
→ 用户通过 -map 手动选择
```

整个流程可以先理解成：

```text
Input
  ↓
多个 Stream
  ↓
Stream Selection
  ↓
选择需要的 Stream
  ↓
编码 / Copy
  ↓
Output
```

---

# 2. Automatic Stream Selection：自动选择

如果输出文件没有使用：

```bash
-map
```

FFmpeg 会根据输出格式和输入中的 Stream 自动选择。

例如：

```bash
ffmpeg -i input.mp4 output.mp4
```

没有 `-map`，所以：

```text
input.mp4
    ↓
FFmpeg 自动选择 Stream
    ↓
output.mp4
```

---

# 3. 自动选择规则

假设有三个输入：

```text
A.avi
├── Video 640x360
└── Audio 2 channels

B.mp4
├── Video 1920x1080
├── Audio 2 channels
├── Subtitle 0
├── Audio 5.1 channels
└── Subtitle 1

C.mkv
├── Video 1280x720
├── Audio 2 channels
└── Subtitle
```

## Video

默认选择：

> 分辨率最高的视频 Stream。

这里：

```text
A → 640x360
B → 1920x1080
C → 1280x720
```

因此选择：

```text
B.mp4 → 1920x1080
```

---

## Audio

默认选择：

> 声道数最多的 Audio Stream。

这里：

```text
A → 2 channels
B → 2 channels
B → 5.1 channels
C → 2 channels
```

因此选择：

```text
B.mp4 → 5.1 channels
```

---

## Subtitle

字幕比较特殊。

字幕可能分为：

```text
文本字幕
图片字幕
```

例如：

```text
SRT
→ 文本字幕

DVD Subtitle
→ 图片字幕
```

FFmpeg 会考虑：

```text
输入字幕类型
+
输出容器默认字幕编码器
```

选择第一个兼容的字幕 Stream。

---

## 条件相同

如果多个 Stream 条件相同，则：

> 优先选择 Index 更小的 Stream。

例如：

```text
Stream #0:0
```

通常优先于：

```text
Stream #1:0
```

---

## Data / Attachment

以下类型不会自动选择：

```text
Data
Attachment
```

如果需要输出，需要使用：

```bash
-map
```

手动选择。

---

# 4. 禁止某类 Stream

FFmpeg 可以直接禁止某类 Stream 输出：

| 参数    | 作用           |
| ----- | ------------ |
| `-vn` | 不输出 Video    |
| `-an` | 不输出 Audio    |
| `-sn` | 不输出 Subtitle |
| `-dn` | 不输出 Data     |

例如：

```bash
ffmpeg -i input.mp4 -an output.mp4
```

表示：

```text
Video → 保留
Audio → 不输出
```

---

# 5. Manual Stream Selection：手动选择

使用：

```bash
-map
```

可以明确告诉 FFmpeg：

> 我要哪些 Stream。

例如：

```bash
ffmpeg -i input.mp4 -map 0:v output.mp4
```

表示：

```text
Input 0
  ↓
所有 Video Stream
  ↓
output.mp4
```

此时不会再自动帮这个输出选择普通输入 Stream。

---

# 6. `-map` 怎么理解

常见形式：

```text
-map 输入编号:Stream类型:该类型中的编号
```

例如：

```bash
-map 0:v:0
```

拆开：

```text
0
↓
Input 0

v
↓
Video

0
↓
第一个 Video
```

所以：

```text
-map 0:v:0
```

表示：

> Input 0 的第一个 Video Stream。

---

## 常见写法

```bash
-map 0:v
```

Input 0 的所有 Video。

```bash
-map 0:v:0
```

Input 0 的第一个 Video。

```bash
-map 0:a
```

Input 0 的所有 Audio。

```bash
-map 0:a:0
```

Input 0 的第一个 Audio。

```bash
-map 1:a:0
```

Input 1 的第一个 Audio。

---

# 7. Selection 和 Handling 不要混淆

这是这一节非常重要的概念。

## Stream Selection

解决：

> 选择谁？

典型参数：

```bash
-map
```

---

## Stream Handling

解决：

> 选出来以后怎么处理？

典型参数：

```bash
-c
```

例如：

```bash
-c:v libx264
```

表示：

> Video 使用 libx264 重新编码。

而：

```bash
-c:a copy
```

表示：

> Audio 直接复制 Packet，不重新编码。

注意：

```text
copy ≠ 编码方式
```

`copy` 表示跳过 Decoder / Encoder。

---

# 8. 完整例子

```bash
ffmpeg \
-i input.mp4 \
-map 0:v:0 \
-map 0:a:0 \
-c:v libx264 \
-c:a copy \
output.mp4
```

先进行 Stream Selection：

```text
-map 0:v:0
→ 选择第一个 Video

-map 0:a:0
→ 选择第一个 Audio
```

然后进行 Stream Handling：

```text
-c:v libx264
→ 视频重新编码

-c:a copy
→ 音频直接复制
```

最终：

```text
                 ┌→ Video → Decoder → libx264 ─┐
input.mp4 ───────┤                            ├→ output.mp4
                 └→ Audio → Copy ─────────────┘
```

可以记成：

```text
-map
↓
选谁

-c
↓
怎么处理
```

---

# 9. 没有指定 `-c` 会怎么样

例如：

```bash
ffmpeg -i input.mp4 output.mp4
```

FFmpeg 会做两件事：

```text
1. 自动选择 Stream

2. 为输出 Stream 选择默认 Encoder
```

所以：

```text
没有 -c copy
```

不代表直接复制。

通常是：

```text
Input Packet
    ↓
Decoder
    ↓
Frame
    ↓
默认 Encoder
    ↓
新 Packet
    ↓
Output
```

也就是：

```text
Transcoding
```

---

# 10. 字幕为什么比较特殊

假设：

```text
C.mkv
├── Video
├── Audio
└── Image Subtitle
```

执行：

```bash
ffmpeg -i C.mkv output.mkv
```

即使 MKV 本身支持字幕：

```text
也不代表这个字幕一定被自动选择
```

FFmpeg 还会考虑：

```text
输入字幕类型
↓
文本 / 图片

输出默认 Subtitle Encoder
↓
是否兼容
```

---

# 11. 指定字幕 Encoder

例如：

```bash
ffmpeg -i C.mkv out1.mkv -c:s dvdsub -an out2.mkv
```

注意这个命令有两个输出：

```text
out1.mkv
out2.mkv
```

其中：

```bash
-c:s dvdsub -an out2.mkv
```

作用于：

```text
out2.mkv
```

表示：

```text
Subtitle
→ 使用 dvdsub Encoder

Audio
→ 不输出
```

因此 `out2.mkv` 中会选择：

```text
Video
Subtitle

不包含 Audio
```

---

# 12. Complex Filter 为什么会影响 Stream Selection

前面的：

```bash
-map 0:v
```

选择的是：

> 输入文件原本存在的 Stream。

但 Filter 也可以产生新的 Stream。

例如：

```text
Video A ─┐
         ├── overlay → 新 Video
Video B ─┘
```

这里：

```text
overlay 的结果
```

已经是一条新的 Video Stream。

因此 FFmpeg 不仅要考虑：

```text
输入 Stream
```

还要考虑：

```text
Filter 输出 Stream
```

---

# 13. 先理解 Filtergraph 中的 `[xxx]`

这是最容易混淆的地方。

例如：

```bash
-filter_complex "[1:v]hue=s=0[outv]"
```

不要一次看整行。

拆开。

---

## `[1:v]`

```text
[1:v]
```

表示：

> Input 1 的 Video Stream。

也就是：

```text
Input 1
   ↓
Video
```

它是 Filter 的：

```text
输入
```

---

## `hue=s=0`

```text
hue=s=0
```

是 Filter。

这里可以简单理解成：

```text
将画面处理成灰度效果
```

---

## `[outv]`

```text
[outv]
```

表示：

> 给 Filter 处理后的输出起一个名字。

名字叫：

```text
outv
```

所以：

```bash
[1:v]hue=s=0[outv]
```

整体就是：

```text
Input 1 Video
      ↓
    hue
      ↓
灰度 Video
      ↓
名字叫 outv
```

可以类比 Java：

```java
Video outv = hue(input1Video);
```

---

# 14. 什么是 Label

下面这些：

```text
[outv]
[video1]
[tmp]
[result]
```

都可以理解成：

> Filtergraph 中某一路数据的名字。

这种名字叫：

```text
Label
```

最简单理解：

```text
Label ≈ 变量名
```

例如：

```text
[outv]
```

就类似：

```java
Video outv;
```

它不是：

```text
文件名
```

也不是：

```text
Stream #0:0
```

而是：

> Filtergraph 内部给某一路数据起的名字。

---

# 15. `-map "[outv]"` 到底是什么意思

假设：

```bash
-filter_complex "[1:v]hue=s=0[outv]"
```

现在已经产生：

```text
[outv]
```

但是 FFmpeg 还不知道：

> 这个结果应该放到哪个输出文件。

所以需要：

```bash
-map "[outv]"
```

告诉 FFmpeg：

> 把 Filtergraph 中名字叫 `outv` 的 Stream 加入当前 Output。

完整命令：

```bash
ffmpeg \
-i A.mp4 \
-i B.mp4 \
-filter_complex "[1:v]hue=s=0[outv]" \
-map "[outv]" \
output.mp4
```

流程：

```text
B.mp4
 ↓
Input 1 Video
 ↓
hue
 ↓
[outv]
 ↓
-map "[outv]"
 ↓
output.mp4
```

所以：

```text
-map 1:v
```

是选择：

```text
原始 Input Stream
```

而：

```text
-map "[outv]"
```

是选择：

```text
Filter 处理以后产生的 Stream
```

区别非常重要。

---

# 16. 原始 Stream 和 Filter Stream

可以这样区分：

```text
input.mp4
   ↓
[0:v]
   ↓
原始视频
```

执行：

```text
Filter
```

后：

```text
[0:v]
  ↓
scale
  ↓
[outv]
```

现在有两种东西：

```text
[0:v]
→ 输入 Stream

[outv]
→ Filter 输出 Stream
```

---

# 17. Unlabeled Filter Output

Filter 输出可以：

```text
有 Label
```

也可以：

```text
没有 Label
```

例如：

```bash
-filter_complex "overlay"
```

这里 `overlay` 的输出没有：

```text
[outv]
```

这种叫：

```text
Unlabeled Output
```

也就是：

> 未命名 Filter 输出。

---

# 18. Unlabeled Output 会去哪里

官方规则：

> 未命名的 Complex Filtergraph 输出会自动加入第一个 Output。

例如：

```bash
ffmpeg \
-i A.avi \
-i C.mkv \
-filter_complex "overlay" \
out1.mp4
```

`overlay` 需要两个 Video。

如果没有手动指定：

```text
A Video ─┐
         ├── overlay
C Video ─┘
```

得到：

```text
overlay result
```

因为没有 Label：

```text
overlay result
      ↓
自动加入
      ↓
out1.mp4
```

---

# 19. Unlabeled 和 Labeled 的区别

## Unlabeled

```bash
-filter_complex "overlay"
```

```text
A Video ─┐
         ├→ overlay → 未命名
B Video ─┘                ↓
                     第一个 Output
```

FFmpeg 自动处理。

---

## Labeled

```bash
-filter_complex "...[outv]"
```

```text
Video
 ↓
Filter
 ↓
[outv]
 ↓
等待用户指定 Output
```

必须：

```bash
-map "[outv]"
```

---

# 20. 为什么 Labeled Output 必须 Map

假设：

```bash
ffmpeg \
-i input.mp4 \
-filter_complex "[0:v]hue=s=0[outv]" \
output.mp4
```

Filter 已经创建：

```text
[outv]
```

但是没有：

```bash
-map "[outv]"
```

相当于：

```java
Video outv = hue(video);

// 后面再也没使用 outv
```

FFmpeg 会认为：

```text
Filter 输出被创建了
但是没有任何 Output 使用它
```

因此命令会失败。

正确：

```bash
ffmpeg \
-i input.mp4 \
-filter_complex "[0:v]hue=s=0[outv]" \
-map "[outv]" \
output.mp4
```

---

# 21. 一个 Label 只能消费一次

假设：

```bash
-filter_complex "[0:v]hue=s=0[outv]"
```

得到：

```text
[outv]
```

不能直接：

```bash
-map "[outv]" output1.mp4 \
-map "[outv]" output2.mp4
```

因为：

```text
[outv]
```

是一条 Filter 输出链路。

它不能直接被两个地方同时消费。

可以理解：

```text
              ┌→ output1
[outv] ───────┤
              └→ output2

× 不能直接这样
```

---

# 22. 如果一个 Filter 输出要给两个地方

需要：

```text
split
```

将一条 Video Stream 分成两条。

例如：

```bash
-filter_complex "[0:v]hue=s=0,split=2[outv1][outv2]"
```

拆开：

```text
[0:v]
  ↓
hue
  ↓
split
 ↙   ↘
[outv1] [outv2]
```

现在已经真正产生两条输出 Stream。

可以：

```bash
-map "[outv1]" output1.mp4 \
-map "[outv2]" output2.mp4
```

完整：

```text
Input Video
     ↓
    hue
     ↓
   split
   ↙   ↘
outv1 outv2
  ↓     ↓
MP4-1  MP4-2
```

---

# 23. Label 这一部分最终只记这张图

```text
原始 Input Stream
      ↓
    [0:v]
      ↓
    Filter
      ↓
    [outv]
      ↓
-map "[outv]"
      ↓
Output
```

其中：

```text
[0:v]
```

代表：

> 输入文件中的 Video。

```text
[outv]
```

代表：

> Filter 处理后产生的新 Stream，并给它起名 outv。

```text
-map "[outv]"
```

代表：

> 把 outv 放到输出文件。

---

# 24. 实际场景：替换视频声音

假设：

```text
video.mp4
├── Video
└── Audio

new_audio.aac
└── Audio
```

目标：

```text
video.mp4 的 Video
+
new_audio.aac 的 Audio
↓
output.mp4
```

命令：

```bash
ffmpeg \
-i video.mp4 \
-i new_audio.aac \
-map 0:v:0 \
-map 1:a:0 \
-c:v copy \
-c:a copy \
output.mp4
```

流程：

```text
Input 0 Video ──┐
                │
                ├──→ output.mp4
                │
Input 1 Audio ──┘
```

这里完全没有 Filter，所以：

```text
不涉及 Label
```

---

# 25. 实际场景：只提取音频

```bash
ffmpeg \
-i input.mp4 \
-map 0:a:0 \
-c:a copy \
audio.aac
```

流程：

```text
input.mp4
    ↓
Demuxer
    ↓
Audio Stream
    ↓
-map 0:a:0
    ↓
Copy
    ↓
audio.aac
```

---

# 26. 实际场景：只提取视频

```bash
ffmpeg \
-i input.mp4 \
-map 0:v:0 \
-c:v copy \
-an \
video.mp4
```

结果：

```text
Video ✓
Audio ×
```

实际上因为已经明确：

```bash
-map 0:v:0
```

这里只会映射视频，所以这里的：

```bash
-an
```

属于额外强调，不是必须。

可以简化：

```bash
ffmpeg -i input.mp4 -map 0:v:0 -c:v copy video.mp4
```

---

# 27. 实际场景：Filter 后输出

例如把视频变成灰度：

```bash
ffmpeg \
-i input.mp4 \
-filter_complex "[0:v]hue=s=0[outv]" \
-map "[outv]" \
-c:v libx264 \
output.mp4
```

处理过程：

```text
input.mp4
    ↓
[0:v]
    ↓
Decoder
    ↓
Frame
    ↓
hue=s=0
    ↓
[outv]
    ↓
-map "[outv]"
    ↓
libx264
    ↓
output.mp4
```

这里同时出现了：

```text
Stream Selection
Filter
Stream Handling
```

分别是：

```text
[0:v]
→ Filter 输入

[outv]
→ Filter 输出 Label

-map "[outv]"
→ 选择 Filter 输出

-c:v libx264
→ 对输出进行编码
```

---

# 28. 整个 Stream Selection 的关系

最终可以整理成：

```text
                     Input
                       ↓
               原始多个 Stream
                       ↓
          ┌────────────┴────────────┐
          │                         │
          ↓                         ↓
    Automatic Selection           -map
          │                         │
          └────────────┬────────────┘
                       ↓
                Selected Stream
                       ↓
                    Filter
                       ↓
              Filter Output Stream
                       ↓
                     -map
                       ↓
                      -c
                       ↓
               Copy / Encoder
                       ↓
                     Muxer
                       ↓
                    Output
```

不一定每次都有 Filter。

普通场景：

```text
Input
 ↓
-map
 ↓
-c
 ↓
Output
```

复杂 Filter 场景：

```text
Input
 ↓
Filter
 ↓
[outv]
 ↓
-map "[outv]"
 ↓
-c
 ↓
Output
```

---

# 29. 当前阶段最重要的内容

## 自动选择

没有：

```bash
-map
```

FFmpeg 自动选择：

```text
Video
→ 分辨率最高

Audio
→ 声道最多

Subtitle
→ 第一个类型兼容的字幕

Data / Attachment
→ 不自动选择
```

---

## 手动选择

```bash
-map 0:v:0
```

表示：

```text
Input 0 的第一个 Video
```

---

## 排除

```text
-vn → 不要 Video
-an → 不要 Audio
-sn → 不要 Subtitle
-dn → 不要 Data
```

---

## Handling

```bash
-c:v libx264
```

表示重新编码。

```bash
-c:v copy
```

表示直接复制。

所以：

```text
-map = 选谁

-c = 怎么处理
```

---

## Filter Label

这一部分只需要先记：

```text
[0:v]
→ Input 0 的 Video

[outv]
→ Filter 输出的名字

-map "[outv]"
→ 把这个 Filter 输出放到 Output
```

例如：

```bash
-filter_complex "[0:v]hue=s=0[outv]" \
-map "[outv]"
```

翻译成人话：

> 取 Input 0 的视频 → 做 hue 处理 → 把处理结果叫做 outv → 把 outv 放进输出文件。

如果这一句话能够理解，Label 这一部分就已经掌握了大半。
