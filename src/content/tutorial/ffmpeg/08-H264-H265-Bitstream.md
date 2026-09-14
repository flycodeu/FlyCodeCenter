---
title: 看懂 H.264 / H.265 码流：视频到了，画面为什么还没出来
createTime: '2026/09/08 20:20:00'
code: tffmpeg-bitstream
permalink: /tutorials/tffmpeg-bitstream/
summary: 从一段 6 秒视频出发，看懂关键帧、I/P/B、NAL、SPS/PPS 和直播首帧，并知道每条命令在问什么。
description: 面向已经会用 FFmpeg 转码的读者：先跑通样本，再对着数据理解码流，最后用同一条链排查黑屏、花屏和 missing PPS。
order: 9
tags:
  - FFmpeg
  - H.264
  - H.265
  - Bitstream
  - RTSP
  - PowerShell
category: 音视频
showOnHome: false
---

切片和直播排查会遇到这些问题：

- 用 `-c copy` 切片，开头可能对不齐；
- 摄像头 RTSP 已经连上，却还没有画面；
- 日志里出现 `non-existing PPS 0 referenced` 或 `no frame!`；
- 把 MP4 改成 `.h264` 后缀播不了，在 MP4 里也搜不到 `00 00 00 01`。

理解这些现象，需要区分压缩帧的参考关系、NAL 单元和容器包装。下面先生成短视频，再用 `ffprobe` 和 `trace_headers` 观察同一份素材；最后将这些概念用于 RTSP 排查。

```mermaid
flowchart LR
  A[原始画面] --> B[H.264 / H.265 编码]
  B --> C[互相依赖的压缩帧]
  C --> D[NAL 单元]
  D --> E[MP4 文件或 RTP 包]
  E --> F[解封装或重组]
  F --> G[解码器]
  G --> H[能显示的画面]
```

检查首帧时，先确认：

1. 一幅画面所需的 NAL 数据是否完整；
2. 引用的参数集是否可用（SPS / PPS，H.265 还要 VPS）；
3. 一个可以重新开始解码的点（常见是 IDR）。

需要时可按这张表回查术语：

| 名字 | 先把它理解成 | 你为什么要管它 |
| --- | --- | --- |
| 关键帧 / IDR | 关键帧是工具标记；IDR 有明确的参考刷新语义 | 判断能否从这里开始解码，两者不能一概等同 |
| GOP | 按参考关系组织的一组图像 | GOP 长度与随机访问间隔有关，但不是同一定义 |
| I / P / B 帧 | 帧内预测与不同的帧间预测方式 | 理解参考依赖与 PTS/DTS 重排 |
| NAL Unit | 压缩数据的一只带类型标签的信封 | 文件、RTP、报错都在这层发生 |
| SPS / PPS | 解码器说明书 | `missing PPS` 就是说明书没拿到 |
| Annex B | 用 `00 00 01` 标出每只信封从哪开始 | `.h264` 文件常见这种写法 |
| Bitstream Filter | 不解码就处理压缩数据 | 可和 `-c copy` 一起用，作用不只限于包装 |

建议新建一个空目录，在该目录打开 PowerShell，后面的文件都会写在这里。

## 先做出这段 6 秒视频

先确认本机有 H.264 Encoder 和后面要用的 Bitstream Filter：

```powershell
ffmpeg -hide_banner -encoders 2>&1 | Select-String "libx264|libx265"
ffmpeg -hide_banner -bsfs 2>&1 | Select-String "h264_mp4toannexb|hevc_mp4toannexb|trace_headers|filter_units"
```

`-encoders` 列出可用编码器，`-bsfs` 列出码流滤镜；`2>&1` 将日志合并到流水线，`Select-String` 筛选名称。本实验要求构建包含 `libx264`。

在空目录中生成测试视频。`-y` 会覆盖同名实验文件：

```powershell
ffmpeg -y -f lavfi -i "testsrc2=size=640x360:rate=25:duration=6" -an -c:v libx264 -g 50 -keyint_min 50 -sc_threshold 0 -pix_fmt yuv420p .\h264-gop.mp4
```

输入是 6 秒、25 帧/秒、640×360 的测试画面，使用 libx264 编码，并关闭场景切换触发的关键帧插入。下面再探测实际关键帧位置。

| 片段 | 它在做什么 |
| --- | --- |
| `-y` | 输出已存在时直接覆盖。这是实验文件，允许覆盖 |
| `-f lavfi` | 输入不是磁盘文件，而是 FFmpeg 的滤镜虚拟源 |
| `testsrc2=...` | 内置动态测试画面；时间位置通过帧时间戳观察 |
| `-an` | 不要音频。这篇只观察视频码流 |
| `-c:v libx264` | 用 libx264 把画面压成 H.264 |
| `-g 50` | 最多隔 50 帧给一个关键帧。25 帧/秒时约为 2 秒 |
| `-keyint_min 50` | 请求最小关键帧间隔为 50；编码器可能约束该值，不能单靠它保证固定 GOP |
| `-sc_threshold 0` | 关闭场景切换触发的关键帧插入 |
| `-pix_fmt yuv420p` | 使用兼容性较好的像素格式 |
| `.\h264-gop.mp4` | 输出写到当前目录 |

成功后当前目录会出现 `h264-gop.mp4`，大约 6 秒、150 帧。现在不要去读二进制，先问它一个最实际的问题。

## 哪些时刻可以安全开始看

**这条命令在问：哪些帧被 FFmpeg 标成了关键帧？**

```powershell
ffprobe -v error -select_streams v:0 -skip_frame nokey -show_frames -show_entries "frame=best_effort_timestamp_time,key_frame,pict_type" -of compact .\h264-gop.mp4
```

| 片段 | 它在做什么 |
| --- | --- |
| `-v error` | 普通日志关掉，只留错误 |
| `-select_streams v:0` | 只看第一条视频流。编号从 0 开始 |
| `-skip_frame nokey` | 跳过非关键帧。名字容易读反：这里的 `nokey` 表示“非关键帧不要” |
| `-show_frames` | 看解码后的帧信息，不是压缩包 |
| `-show_entries "frame=..."` | 只打印时间、是否关键帧、帧类型 |
| `-of compact` | 尽量让一帧占一行 |

本文使用的 FFmpeg 7.1.1 与 libx264 会看到三个时间点：

```text
0.000000  I  key_frame=1
2.000000  I  key_frame=1
4.000000  I  key_frame=1
```

上面是从探测结果整理出的关键字段，省略了 SEI 等附加信息。本样本中相邻关键帧间隔为 2 秒；这不是所有视频的固定间隔。

这也解释了第 03、05 篇里的切片现象：`-c copy` 通常只能从附近的关键帧开始安全解码，所以切点对不齐；HLS 的 `-hls_time 6` 同样常在关键帧处切开，分片不必恰好 6 秒。

### 为什么不能从任意一帧开始

按未压缩 RGB24 计算，每个像素 3 字节，1920×1080、25 帧/秒的数据量为（MB 使用十进制单位）：

```text
一帧：1920 × 1080 × 3 ≈ 6.22 MB
一秒：6.22 MB × 25 ≈ 155 MB/s
```

这里忽略行对齐等开销；换成 YUV420 或其他像素格式，数据量会不同。视频压缩可以利用同一帧内的空间相关性，也可以利用不同帧之间的时间相关性。

假设一个球从画面左边移到右边：

```text
第 0 帧：● · · · ·
第 1 帧：· ● · · ·
第 2 帧：· · ● · ·
```

这只是帮助理解时间相关性的示意。编码器实际以块为单位选择预测方式，日常常用 I/P/B 描述图像类型：

| 日常说法 | 预测方式 | 缺失时的影响 |
| --- | --- | --- |
| I 帧 | 使用帧内预测，不依赖其他图像做帧间预测 | 若被后续图像参考，丢失可能影响它们 |
| P 帧 | 可使用一组参考列表做帧间预测，也可有帧内编码块 | 引用的参考图像缺失时，预测可能失效 |
| B 帧 | 可使用两组参考列表，参考图像不限定为显示顺序的一前一后 | 引用较晚显示的图像时，需要调整解码顺序 |

I 帧仍然经过压缩，解码时还需要参数集。P/B 描述的是允许使用的预测方式，不能理解成“每个块都依赖别的帧”；B 帧也可能成为其他图像的参考。以下箭头只示意一种参考关系，从被参考图像指向使用它的图像。

```mermaid
flowchart LR
  I0[I 帧]
  P1[P 帧]
  B1[B 帧]
  P2[P 帧]
  I0 --> P1
  I0 --> B1
  P1 --> B1
  P1 --> P2
```

### GOP 与随机访问间隔

GOP 是 Group of Pictures，即一组图像。闭合 GOP 的参考不跨组；开放 GOP 可以引用组外图像。因此，GOP 边界不必然等于可独立起播点，不能只凭 GOP 长度判断随机访问能力。

本样本是 25 帧/秒、关键帧间隔 50 帧：

```text
50 帧 ÷ 25 帧/秒 = 2 秒

时间:  0s        2s        4s        6s
      IDR ------ IDR ------ IDR ---- 结束
      |<- 约 2 秒一个 GOP ->|
                    ↑
              若在 2.6 秒加入直播，
              无缓存或关键帧请求时，
              可能要等下一个起点
```

这是按本样本关键帧位置构造的时间示意，不是摄像头实测。若服务端只发当前位置的数据，客户端在 2.6 秒加入会错过 2 秒的起点；没有可用缓存或其他恢复机制时，可能需要等待 4 秒附近的起点。实际首帧还受参数集、丢包、缓冲和解码影响。

所以 GOP 是一种取舍，不是越大越好：

| GOP 较长 | GOP 较短 |
| --- | --- |
| 完整画面重复得少，通常更省码率 | 起播、Seek、花屏恢复通常更快 |
| 中途加入可能等得更久 | 关键帧更勤，码率开销更大 |

摄像头页面上写的 “GOP=50” 只是配置。最后仍要用 `ffprobe` 看实际关键帧时间，不要只信配置数字。

### 关键帧、I 帧、IDR 不要画等号

日常说“I 帧、关键帧”便于沟通。排障时再分清一层：

- **I 帧**：这一帧主要靠自己画出来；
- **IDR**：不但自己能画出来，还切断参考关系——IDR 之后的帧，不许再去找 IDR 之前的画面；
- **`key_frame=1`**：这是 FFmpeg 给出的关键帧标记。本样本里它和 IDR 对得上，但不能在所有文件、所有编码器上直接翻译成某一个 NAL 类型。

直播起播、Seek、花屏后恢复，真正要等的通常是这种**切断参考关系**的点。H.265 里除了 IDR，还有一种 CRA，也可以当随机访问点，但规则更松；后面对照 H.265 时再看一眼即可。


## 为什么文件里的顺序和观看顺序不一样

B 帧可以参考后面的画面，所以文件里的数据顺序不一定等于观看顺序。压缩包上因此常常有两个时间戳：

- **PTS**（Presentation Timestamp）：什么时候显示给观众；
- **DTS**（Decoding Timestamp）：什么时候送进解码器。

**这条命令在问：前几个压缩包的显示时间和解码时间分别是什么？**

```powershell
ffprobe -v error -select_streams v:0 -read_intervals "%+#8" -show_packets -show_entries "packet=pts_time,dts_time,flags" -of csv=p=0 .\h264-gop.mp4
```

| 片段 | 它在做什么 |
| --- | --- |
| `-read_intervals "%+#8"` | 从开头读 8 个包。`#8` 是数量，**不是 8 秒** |
| `-show_packets` | 看压缩包，不是解码后的帧 |
| `pts_time,dts_time,flags` | 只打印显示时间、解码时间和标记 |
| `-of csv=p=0` | 逗号分隔，不打印字段名 |

可直接查看本机输出。下面只示意一种 I/B/P 重排关系，不作为上面命令的逐行实测结果：

```text
0.000000,-0.080000,K__
0.080000,-0.040000,___
0.040000, 0.000000,___
0.160000, 0.040000,___
```

每一行是：PTS，DTS，标记。`K` 表示 FFmpeg 把这个包标成了 key packet。注意第二行 PTS 是 `0.08`，第三行才是 `0.04`：要先解码 0.08 秒那一帧，才能正确画出 0.04 秒那一帧。

```text
观看顺序：I   B   P
显示时间：0   0.04  0.08
解码顺序：I   P   B
```

只要时间关系合理，**PTS 和 DTS 不相等不是文件损坏。** 有 B 帧时这很正常。看到 `Non-monotonous DTS` 时，先检查切片、拼接和时间轴，不要一上来就把 PTS 复制给 DTS。

开头 DTS 出现 `-0.080000` 也常见：解码器需要提前准备参考帧，时间轴会往前留一点。不要把它单独当成“时间戳坏了”。

## 压缩数据里到底装了什么

H.264 / H.265 用 NAL Unit（Network Abstraction Layer Unit）组织压缩数据。可将它比作带类型标签的信封：头部说明类型，负载保存对应内容。这个比喻只帮助区分头部和负载，NAL 与一帧画面不一定一一对应。


MP4 是容器，里面的 H.264 通常不按 `00 00 01` 这种直观方式摆 NAL Unit。要亲眼看见边界，需要先把视频流抽成 raw H.264：

```powershell
ffmpeg -y -i .\h264-gop.mp4 -map 0:v:0 -c:v copy -an -bsf:v h264_mp4toannexb .\h264-gop.h264
```

这条命令在做什么：不重新编码画面，只改信封边界的写法，输出 `h264-gop.h264`。

| 片段 | 它在做什么 |
| --- | --- |
| `-map 0:v:0` | 只要第 1 个输入里的第 1 路视频 |
| `-c:v copy` | 复制压缩数据，不解码、不重压 |
| `-an` | 不要音频 |
| `-bsf:v h264_mp4toannexb` | 视频 Bitstream Filter：把 MP4 的长度前缀改成 Annex B 起始码 |
| `.\h264-gop.h264` | 没有 MP4 容器的裸 H.264 文件 |

这里的 `.h264` 仍然是压缩数据，只是没有容器。改文件名后缀做不到这件事。

看文件开头的字节：

```powershell
Format-Hex -Path .\h264-gop.h264 -Count 32
```

`Format-Hex` 是 PowerShell 自带的十六进制查看工具，不是 FFmpeg 命令。若当前版本没有 `-Count`，改用 `Format-Hex -Path .\h264-gop.h264 | Select-Object -First 8`。在 `HexBytes` 里会看到类似：

```text
00 00 00 01 06 05 FF FF A9 DC 45 E9 BD E6 D9 48
```

按块读：

```text
00 00 00 01     下一只信封从这里开始（Annex B 起始码）
06              信封类型：6，SEI（补充信息，不是画面本身）
后面一串        这只信封的内容。本样本里能看到 x264 的标识文字
```

起始码还有 3 字节写法 `00 00 01`。本样本里，SEI / SPS / PPS 前面是 `00 00 00 01`，第一帧 IDR 前面则是 `00 00 01`。看见其中一种即可定位边界。

文件开头**不一定**是 SPS。本样本就是 SEI 打头，然后才是 SPS、PPS、IDR：

```text
00 00 00 01 06   SEI   类型 6
00 00 00 01 67   SPS   类型 7
00 00 00 01 68   PPS   类型 8
00 00 01    65   IDR   类型 5
00 00 00 01 41   普通 Slice  类型 1
```

`67`、`68`、`65` 是信封头的那一个字节，类型是它的低 5 位，所以 `0x67` 是类型 7，不是类型 67。不要靠背“必须以 67 开头”来判断码流对不对。

### 用 trace_headers 查看 NAL 头部

手算十六进制只适合看开头。要确认整段码流里有哪些类型，用 `trace_headers`：

```powershell
ffmpeg -hide_banner -loglevel verbose -i .\h264-gop.mp4 -map 0:v:0 -c:v copy -bsf:v trace_headers -f null - 2>&1 | Select-String "Sequence Parameter Set|Picture Parameter Set|nal_unit_type|slice_type"
```

先从中间的竖线切开：

```text
左边：FFmpeg 读取并打印码流语法
右边：PowerShell 只留下你关心的行
```

| 片段 | 它在做什么 |
| --- | --- |
| `-loglevel verbose` | 把 Header 细节打到日志 |
| `-c:v copy` | 不重新编码，只检查已有压缩数据 |
| `-bsf:v trace_headers` | Bitstream Filter：解析并打印语法，不改画面 |
| `-f null -` | 丢弃输出，只观察日志；`-` 是常用的输出占位，null 也可接其他输出名称 |
| `Select-String "..."` | 从大量日志里筛关键词 |

本样本能看到：

```text
Sequence Parameter Set
nal_unit_type ... = 7
Picture Parameter Set
nal_unit_type ... = 8
nal_unit_type ... = 6
nal_unit_type ... = 5
nal_unit_type ... = 1
```

排障时先记住这张小表：

| H.264 类型 | 内容 | 排查时注意 |
| ---: | --- | --- |
| 7 SPS | 序列级说明书：宽高、档次等 | 解码器不知道怎么解释后面的画面 |
| 8 PPS | 更靠近每一帧的说明书 | 常见报错 `non-existing PPS` |
| 5 IDR Slice | IDR 图像中的一个片 | 独立起播还需该图像的数据完整且参数集可用 |
| 1 非 IDR Slice | 非 IDR 图像中的片，可为 I/P/B 等类型 | 要继续看 Slice 类型与参考关系，不能直接等同于 P/B |
| 6 SEI | 补充信息，例如编码器标识 | 通常不是出画的关键 |

一帧画面可以只装在一只信封里，也可以拆成多只。和一帧对应的那一组信封，标准里叫 Access Unit。常见文件里，一个视频 `AVPacket` 往往刚好对应一帧所需数据，但这不是所有输入都保证的一一关系。先分清职责：

```text
MP4 容器     组织视频、音频和时间信息
AVPacket     FFmpeg 在程序里传递的一包压缩数据
NAL Unit     H.264/H.265 自己的信封
Access Unit  解码出一幅画面所需的那一组信封
AVFrame      解码器交出来的原始画面
```

这些东西不能互相替代。

## 解码器为什么还要一份说明书

信封里的画面数据并不能自己说明“画面有多宽、用了哪些压缩工具”。这些相对稳定的信息如果每帧都带一份，会浪费很多空间，所以抽成参数集，靠 ID 引用。

可以继续用正文与说明书理解引用关系：Slice 头部带有 PPS ID，解码器必须先获得这份 PPS，再找到它引用的 SPS。

```text
H.264：  SPS  ←  PPS  ←  画面数据（Slice）引用 PPS
H.265：  VPS  ←  SPS  ←  PPS  ←  画面数据
```

- **SPS**（Sequence Parameter Set）：序列级配置，例如档次、宽高、色度格式；文件或会话中可以存在多份或更新；
- **PPS**（Picture Parameter Set）：更靠近一帧/一片的配置；
- **VPS**（Video Parameter Set）：H.265 多出来的更高一层说明。

说明书不必出现在每一个包里。它可能在码流内部（in-band），也可能放在 MP4 的解码配置、RTSP 的 SDP，或 FFmpeg 的 `extradata` 里。所以“我在这个包里没搜到 SPS”不等于“SPS 丢了”。真正要问的是：解码器开始读这片画面时，有没有拿到它所引用的那一份。

### 故意删掉说明书，看真实报错

从刚才的裸码流里去掉类型 7 和 8，也就是 SPS 和 PPS：

```powershell
ffmpeg -y -f h264 -i .\h264-gop.h264 -map 0:v:0 -c:v copy -bsf:v "filter_units=remove_types=7|8" .\without-parameter-sets.h264
```

| 片段 | 它在做什么 |
| --- | --- |
| `-f h264` | 明确告诉 FFmpeg：输入是裸 H.264，不要靠扩展名猜 |
| `remove_types=7` 和 `8` | Bitstream Filter 删掉类型 7、8。两个类型之间的竖线是 Filter 参数自己的语法，必须放进引号，否则 PowerShell 会当成管道 |
| `.\without-parameter-sets.h264` | 损坏副本。原始 `h264-gop.h264` 不会被改 |

再尝试解码这个副本，但不保存画面：

```powershell
ffmpeg -hide_banner -v error -f h264 -i .\without-parameter-sets.h264 -f null -
```

会看到：

```text
non-existing PPS 0 referenced
decode_slice_header error
no frame!
```

这个实验中，画面数据仍在，但解码器找不到 Slice 引用的 PPS 0，因此无法正常解析和解码。应先恢复参数集，后续的像素格式或渲染设置不能补回这些数据。

还要注意：这个损坏文件即使打出大量解码错误，FFmpeg **进程仍可能返回 0**。媒体程序不能只看退出码，还要看解码错误、实际输出帧数和时间是否连续。


## 同样的码流，为什么 MP4 和 .h264 长得不像

NAL 的内容可以相同，边界写法却有两种常见选择。

**Annex B**（裸 `.h264` / `.h265`、MPEG-TS 里常见）：用起始码标出下一只信封从哪开始。

```text
00 00 00 01 [信封] 00 00 01 [信封] 00 00 00 01 [信封]
```

**MP4 sample**（MP4 容器里常见）：不靠起始码，而在每个 NAL Unit 前写它有多长。

```text
[长度][信封][长度][信封]...
```

H.264 的解码配置通常放在 `avcC` 盒子里，H.265 对应 `hvcC`。这里可以保存 SPS/PPS，以及长度字段占几个字节。长度常见是 4 字节，但解析程序必须读配置，不能写死为 4。

所以：在 MP4 里搜不到 `00 00 00 01`，不能说明文件里没有 H.264。它很可能只是换了一种边界写法。反过来，把 `input.mp4` 改名为 `input.h264` 也不会自动长出起始码。

如果信封内容自己碰巧出现 `00 00 01`，解析器会误以为下一只信封开始了。编码时会按规则插入 `03` 来避免冲突。看见 payload 里“多余”的 `03`，不要手动删。

### Bitstream Filter 处理压缩数据

`h264_mp4toannexb` / `hevc_mp4toannexb` 属于 Bitstream Filter，工作在压缩数据上：

```mermaid
flowchart LR
  P1[压缩包] --> BSF[Bitstream Filter<br/>改包装]
  BSF --> P2[压缩包]

  P1 --> DEC[解码]
  DEC --> F1[原始帧]
  F1 --> VF[scale / crop / overlay]
  VF --> F2[原始帧]
  F2 --> ENC[重新编码]
```

这两个转换滤镜可以和 `-c:v copy` 一起使用，无需重新编码画面。Bitstream Filter 不只改包装：前面的 `filter_units` 还可以删除 NAL，错误使用会破坏解码。`scale`、裁剪、水印处理解码后的帧，需要为对应输出重新编码。

## 直播已经连上，为什么还是没有画面

RTSP 负责建立和控制会话，视频数据通常由 RTP 带着走。NAL 的大小并不迁就网络包：小的可以一只一包，几只小的可以塞进同一包，很大的一只必须拆开。

RTP 包与 NAL 的关系有几种情况：

- 一只信封可能被拆成多个 RTP 包；
- 一个 RTP 包也可能装着多只小信封；
- 大信封缺了关键一片，整只都拼不回来；
- RTP 序号在涨，只说明包在到达，不说明解码器已经拿到完整的一帧。

因此这些层级不能互换：

```text
UDP 包 ≠ RTP 包 ≠ NAL 信封 ≠ 一帧所需数据 ≠ FFmpeg 的 AVPacket ≠ 解码后的画面
```

下面是将这些概念用于 RTSP 的流程示意。本地 MP4 实验没有建立 RTSP 服务，也没有验证网络传输：

```mermaid
sequenceDiagram
  participant C as 播放器
  participant S as RTSP / RTP
  participant D as 解码器
  C->>S: DESCRIBE / SETUP / PLAY 成功
  S-->>C: RTP 开始到达（可能全是 P/B）
  C->>C: 处理乱序、丢包，拼回 NAL
  C->>C: 从 SDP 或码流拿到说明书
  Note over C: 若还没有可解码的起点，继续等
  S-->>C: 下一个 IDR 到达
  C->>D: 提交可解码的一帧数据
  D-->>C: 输出第一幅画面
```

“RTSP 连接成功”只完成了会话。画面出现之前，还要同时满足：

1. RTP 能持续到达，被拆开的大信封能拼完整；
2. 接收端能还原出完整 NAL；
3. 解码器已经拿到 Slice 引用的 VPS/SPS/PPS；
4. 等到了可随机访问的 IDR（或 H.265 的 CRA），而不是 GOP 中段的 P/B；
5. 解码器真正输出了 `AVFrame`。

首帧等待时间接近随机访问间隔时，可以核对加入时刻与实际 IDR/CRA 到达时刻；黑屏时长本身不足以证明是在等关键帧。RTP 丢包也可能同时影响参数集和画面数据，应结合序号、重组结果和解码日志判断。

说明书可能来自：

| 位置 | 常见情况 | 怎么查 |
| --- | --- | --- |
| 码流内部 | 随机访问点附近重复发送 | `trace_headers` 或看 Annex B |
| RTSP SDP | H.264 常见 `sprop-parameter-sets` | 保存 DESCRIBE 返回的 SDP |
| MP4 配置 | `avcC` / `hvcC` | 看解码配置或 FFmpeg `extradata` |
| FFmpeg `extradata` | Demuxer 整理后交给解码器 | 打开解码器前看 codecpar |

排障时分别记下这些时间点，不要只记“连接成功”：

```text
RTSP PLAY 成功
首个 RTP 到达
首个完整 NAL 拼出
说明书可用
首个可解码的 Access Unit 提交
首个 AVFrame 输出
画面真正显示
```

确认软件解码器能输出帧后，再检查后续的像素格式转换、渲染或推理。若使用硬件解码，硬件初始化和设备错误也可能发生在输出首帧之前，需要同时查看解码器日志。

## H.264 和 H.265：同一条链，几处不能混用

I/P/B、GOP、NAL、说明书、容器和 RTP 分包，两种编码都有对应概念。H.265 不是另一个世界，但不能把 H.264 的类型表和解析方法原样套过去。

| | H.264 / AVC | H.265 / HEVC |
| --- | --- | --- |
| 信封头 | 1 字节 | 2 字节 |
| 类型所占的位 | 低 5 位 | 6 位，读法不同 |
| 说明书 | SPS、PPS | 多一层 VPS |
| 常见随机访问 | IDR 类型 5 | IDR 类型 19/20，CRA 类型 21 |
| MP4 配置 | `avcC` | `hvcC` |
| 转成 Annex B | `h264_mp4toannexb` | `hevc_mp4toannexb` |

本机有 `libx265` 时，可以生成同规格对照样本：

```powershell
ffmpeg -y -f lavfi -i "testsrc2=size=640x360:rate=25:duration=6" -an -c:v libx265 -g 50 -x265-params "min-keyint=50:scenecut=0" -pix_fmt yuv420p .\h265-gop.mp4
```

和 H.264 命令的主要差别：编码器换成 `libx265`，最小关键帧间隔和关闭 scene cut 要写进 `-x265-params`，参数之间用冒号分隔。

```powershell
ffmpeg -hide_banner -loglevel verbose -i .\h265-gop.mp4 -map 0:v:0 -c:v copy -bsf:v trace_headers -f null - 2>&1 | Select-String "Video Parameter Set|Sequence Parameter Set|Picture Parameter Set|nal_unit_type"
```

本样本里可以看到 VPS 类型 32、SPS 33、PPS 34、SEI 39，以及 IDR 类型 20。后面大量的 0 和 1 是普通帧的 Slice。

如果要自己从字节读类型：

```text
H.264：type =  header字节 & 0x1F
        例如 0x67 的低 5 位是 7，即 SPS
H.265：type = (header第一个字节 >> 1) & 0x3F
```

两套位布局不同。把 H.264 的写法复制到 H.265，会读出错误类型。普通排障优先用 `trace_headers`，不必先手写解析器。

H.265 的 CRA 可以当随机访问点，但不是换了名字的 IDR：从 CRA 中途开始时，和 CRA 之前有关的某些帧需要丢掉。直播设备如果实际发的是 CRA 而不是 IDR，起播规则会和 H.264 的直觉略有差别。

## 从会话到解码逐层排查

按数据处理顺序检查，可以区分握手失败、传输不完整和解码之后的显示问题：

1. **会话有没有真正建立？** RTSP 的 DESCRIBE / SETUP / PLAY 和鉴权。这里失败时，媒体还没开始传。
2. **RTP 是否完整？** 看序号、丢包、乱序。带宽在涨，不代表被拆开的大信封已经拼好。
3. **解码器有没有说明书？** 查 SDP、码流内部和 `extradata`。出现 `non-existing PPS` 时，确认 Slice 引用的那个 ID 在不在，而不是只搜“有没有任何 PPS”。
4. **有没有等到可解码的起点？** 用 `ffprobe` 看实际关键帧间隔，对照加入时间和下一次 IDR/CRA。
5. **解码器到底有没有输出帧？** 有帧之后，才去查像素格式、GPU、渲染和模型。

| 你看见的现象 | 最先核对的层级 |
| --- | --- |
| `-c copy` 切片开头不准 | 关键帧 / GOP，不是切点参数写错这么简单 |
| HLS 分片不恰好 N 秒 | 分片通常在关键帧处切开 |
| MP4 里搜不到起始码 | 是否使用长度前缀和 `avcC` / `hvcC` |
| 裸 `.h264` 无法播放 | 是不是 Annex B，有没有 SPS/PPS |
| `non-existing PPS referenced` | 说明书来源，以及 PPS ID 是否匹配 |
| `missing picture in access unit` | 丢包、分片重组、一帧数据是否凑齐 |
| PTS 与 DTS 不同 | 是否有 B 帧重排，不要先认定时间戳损坏 |
| RTSP 连上后固定黑几秒 | 说明书是否已到，实际 IDR 间隔是多少 |
| 花屏一段时间后自动恢复 | 参考帧是否丢失，恢复是否刚好碰到新的 IDR |
| 解码器已经有帧，界面仍黑 | 像素格式、GPU、渲染，而不是继续查 RTSP 握手 |

最后让原始样本完整解码一次，确认本机软件解码器能读完：

```powershell
ffmpeg -v error -i .\h264-gop.mp4 -f null -
ffmpeg -v error -i .\h265-gop.mp4 -f null -
```

没有错误输出，只证明这两个本地样本在当前解码器上可以完整解码。它不等于某台摄像机、某条网络或某个硬件解码器已经验证通过。

相关阅读：[FFprobe 命令查询与理解](/tutorials/t2er6pk59/)、[常见任务与排障案例](/tutorials/t19hdgc9e/)。切片、HLS 分片和 RTSP 拉流的命令组合见案例篇。

本文中的码流语义与命令参考 [ITU-T H.264](https://www.itu.int/rec/T-REC-H.264)、[ITU-T H.265](https://www.itu.int/rec/T-REC-H.265)、[RFC 6184：H.264 RTP Payload Format](https://www.rfc-editor.org/rfc/rfc6184)、[RFC 7798：HEVC RTP Payload Format](https://www.rfc-editor.org/rfc/rfc7798)、[FFmpeg Bitstream Filters Documentation](https://ffmpeg.org/ffmpeg-bitstream-filters.html) 与 [ffprobe Documentation](https://ffmpeg.org/ffprobe.html)。本机验证基线为 FFmpeg 7.1.1 full build 与 libx264 / libx265；不同版本的日志细节可能略有差异，关键是观察关键帧时间、NAL 类型和报错层级。
