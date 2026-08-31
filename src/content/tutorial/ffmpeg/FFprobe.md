---
title: FFprobe 命令查询与理解
createTime: '2026/08/31 10:10:00'
code: t2er6pk59
permalink: /tutorials/t2er6pk59/
summary: 用 ffprobe 查询容器、媒体流、字段、时间和数据，并读懂 JSON 输出。
description: FFprobe 官方命令的入门查询手册：从常用结构探测开始，逐步深入 Stream、Packet、Frame 和程序化输出。
order: 7
tags:
  - FFprobe
  - FFmpeg
  - 媒体分析
  - 命令查询
category: 音视频
---

`ffprobe` 只负责读取和描述媒体，不负责转码、滤镜或播放。它可以检查本地文件、网络 URL 和实时流，是写 FFmpeg 命令前确认输入事实的第一步。

```mermaid
flowchart TB
  I[输入文件 / URL] --> F[FORMAT<br/>容器级信息]
  I --> S[STREAM<br/>视频 · 音频 · 字幕 · 数据]
  S --> P[PACKET<br/>压缩数据]
  P --> R[FRAME<br/>解码后的帧]
  F --> Q[字段筛选与 JSON 输出]
  S --> Q
  P --> Q
  R --> Q
```

从上到下是 `ffprobe` 能观察到的层级，从右侧汇总的是查询配置：先用 `-select_streams` 缩小对象，再用 `-show_entries` 缩小字段，最后用 `-of json` 交给程序处理。

## 先记住这一组命令

| 目的 | 命令选项 | 结果 |
| --- | --- | --- |
| 人工快速查看 | `ffprobe input.mp4` | 可读的容器和流信息 |
| 查看容器 | `-show_format` | `FORMAT` 段，如格式名、时长、大小 |
| 查看媒体流 | `-show_streams` | `STREAM` 段，如编码、尺寸、采样率 |
| 只看某类流 | `-select_streams v:0` | 只保留第一条视频等匹配流 |
| 只取指定字段 | `-show_entries` | 减少输出，适合脚本 |
| 程序读取 | `-of json` | JSON 结构输出 |
| 查看压缩包 | `-show_packets` | Packet 级信息 |
| 查看解码帧 | `-show_frames` | Frame/Subtitle 级信息 |
| 限制分析范围 | `-read_intervals` | 只读取指定时间或数量 |
| 统计数量 | `-count_frames`、`-count_packets` | 把计数写入对应 Stream |

最常用的程序查询可以直接套用：

```powershell
ffprobe -v error -show_entries "format=format_name,duration,size:stream=index,codec_type,codec_name,width,height,pix_fmt,avg_frame_rate,sample_rate,channels" -of json input.mp4
```

翻译成人话：读取 `input.mp4`，隐藏非错误日志，查询容器和每条流的指定字段，并以 JSON 输出。

## 基本语法和日志

官方基本形式是：

```text
ffprobe [options] input_url
```

例如：

```powershell
ffprobe input.mp4
ffprobe "rtsp://user:password@camera/stream"
```

常用通用选项：

```powershell
ffprobe -hide_banner input.mp4
ffprobe -v error -show_format -show_streams -of json input.mp4
```

- `-hide_banner` 隐藏版本横幅；
- `-v error`（`-loglevel error` 的缩写）只保留错误日志，避免日志混入机器输出；
- `-version` 查看当前版本，能力以执行机器为准。

PowerShell 中路径或 URL 含空格、`&`、`?` 等字符时要加引号。命令结束后的 `$LASTEXITCODE` 是进程退出码；它不能替代对 JSON 内容和完整解码结果的检查。

## ffprobe 输出的层级

```text
输入
├── FORMAT       整个容器
├── STREAM       视频、音频、字幕或数据流
├── PROGRAM      MPEG-TS 等格式中的节目（按需）
├── CHAPTER      章节（按需）
└── PACKET/FRAME 逐包或逐帧数据（深入分析）
```

完整 JSON 通常类似：

```json
{
  "streams": [
    { "index": 0, "codec_type": "video", "codec_name": "h264" },
    { "index": 1, "codec_type": "audio", "codec_name": "aac" }
  ],
  "format": {
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "duration": "3.000000"
  }
}
```

`format` 是容器级信息，`streams` 是流级信息。不要假设数组顺序代表媒体类型，使用每条流的 `index` 和 `codec_type` 判断。

## 查看容器：`-show_format`

```powershell
ffprobe -v error -show_format -of json input.mp4
```

常见字段：

| 字段 | 含义 |
| --- | --- |
| `format_name` | 一个或多个可识别的容器/格式名 |
| `format_long_name` | 容器的完整名称 |
| `duration` | 容器报告的总时长，实时流可能为 `N/A` |
| `size` | 文件大小；实时输入可能没有 |
| `bit_rate` | 容器估算的总码率 |
| `start_time` | 容器时间轴起点 |
| `tags` | 容器级元数据，如标题 |

时长是容器提供的描述，不是完整解码证明。文件索引不完整、管道或实时流都可能没有可靠的总时长。

## 查看媒体流：`-show_streams`

```powershell
ffprobe -v error -show_streams -of json input.mp4
```

视频流常用字段：

```powershell
ffprobe -v error -select_streams v:0 -show_entries "stream=index,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,time_base" -of json input.mp4
```

音频流常用字段：

```powershell
ffprobe -v error -select_streams a:0 -show_entries "stream=index,codec_name,sample_rate,channels,channel_layout,sample_fmt,bit_rate" -of json input.mp4
```

| 类型 | 优先观察的字段 |
| --- | --- |
| 视频 | `index`、`codec_name`、`width`、`height`、`pix_fmt`、`r_frame_rate`、`avg_frame_rate` |
| 音频 | `index`、`codec_name`、`sample_rate`、`channels`、`channel_layout`、`bit_rate` |
| 所有流 | `codec_type`、`time_base`、`start_time`、`duration`、`tags`、`disposition` |

`r_frame_rate` 不一定等于实际平均帧率，`avg_frame_rate` 也可能因输入不完整而不可靠；遇到可变帧率或同步问题，再检查 Packet/Frame 时间戳。

## 选择流：`-select_streams`

`-select_streams` 只影响与流有关的查询，例如 `-show_streams`、`-show_packets` 和 `-show_frames`；它不会过滤 `FORMAT` 段。

| 写法 | 含义 |
| --- | --- |
| `v` | 所有视频流 |
| `a` | 所有音频流 |
| `s` | 所有字幕流 |
| `d` | 所有数据流 |
| `v:0` | 第一条视频流 |
| `a:1` | 第二条音频流 |
| `0:v:0` | ffmpeg 的 `-map` 常用写法；ffprobe 的 `-select_streams` 通常省略输入编号 |

示例：

```powershell
ffprobe -v error -select_streams v -show_streams -of json input.mkv
ffprobe -v error -select_streams a:1 -show_streams -of json input.mkv
```

`ffprobe` 负责“显示哪些流”，`ffmpeg -map` 负责“输出哪些流”；两者都使用 Stream Specifier，但用途不同。

## 选择字段：`-show_entries`

基本形式是：

```text
-show_entries section=field1,field2:other_section=field3
```

例如同时查询容器和流：

```powershell
ffprobe -v error -show_entries "format=format_name,duration,size:stream=index,codec_type,codec_name" -of json input.mp4
```

查询标签：

```powershell
ffprobe -v error -show_entries "stream=index,codec_type:stream_tags=language,title" -of json input.mkv
ffprobe -v error -show_entries "format_tags=title,creation_time" -of json input.mp4
```

这里有三个不同层次：

```text
-select_streams  → 选哪些流
-show_entries    → 选哪些 Section 和字段
-of json         → 结果用什么格式输出
```

```mermaid
flowchart LR
  A[要回答的问题] --> B[-select_streams<br/>选流]
  B --> C[-show_entries<br/>选字段]
  C --> D[-read_intervals<br/>可选：限范围]
  D --> E[-of json / csv<br/>选输出格式]
  E --> F[脚本或人工检查]
```

字段不存在时，ffprobe 可能省略它或输出 `N/A`；不要把“字段缺失”直接当成媒体损坏。

## 输出格式：`-of` / `-output_format`

查看当前构建支持的 Writer：

```powershell
ffprobe -h full 2>&1 | Select-String "output printing format"
```

常见格式：

| Writer | 适合场景 |
| --- | --- |
| `json` | 程序、Node.js、Python、Java 读取，入门首选 |
| `default` | 人工阅读的分段文本 |
| `compact` / `csv` | 表格或简单脚本处理 |
| `flat` | 扁平的 `key=value` 路径 |
| `ini` / `xml` | 对接已有格式或工具时按需使用 |

示例：

```powershell
ffprobe -v error -show_streams -of json input.mp4
ffprobe -v error -show_entries "stream=index,codec_name" -of csv=p=0 input.mp4
```

`-of json` 比默认文本更适合程序解析。`-pretty`、`-unit`、`-prefix` 和 `-sexagesimal` 会改变显示形式，适合人看，不建议混入严格的机器接口。

## Packet 和 Frame：什么时候深入

### 查看 Packet

Packet 是容器解复用后、解码前的压缩数据：

```powershell
ffprobe -v error -select_streams v:0 -read_intervals "%+2" -show_packets -of json input.mp4
```

重点字段包括 `pts_time`、`dts_time`、`duration_time`、`size`、`stream_index` 和 `flags`。长视频不要直接输出全部 Packet，先用 `-read_intervals` 限制范围。

### 查看 Frame

Frame 是解码器得到的视频图像或音频采样帧：

```powershell
ffprobe -v error -select_streams v:0 -read_intervals "%+2" -show_frames -show_entries "frame=best_effort_timestamp_time,pkt_duration_time,key_frame,pict_type" -of json input.mp4
```

`-show_frames` 的输出来自解码过程，可能包含 `FRAME` 或 `SUBTITLE` Section；它比读取 Stream 元数据更慢。

Packet 和 Frame 的关系可以简化为：

```text
容器 → Packet（压缩数据）→ Decoder → Frame（解码结果）
```

## 限制读取范围：`-read_intervals`

`read_intervals` 是由逗号分隔的区间列表，常用写法：

| 写法 | 含义 |
| --- | --- |
| `"%+20"` | 从开头附近读取约 20 秒 |
| `"10%+20"` | 从约 10 秒开始读取约 20 秒 |
| `"01:23%+#42"` | 从 1 分 23 秒附近读取 42 个 Packet |

```powershell
ffprobe -v error -read_intervals "%+20" -show_packets -of json input.mp4
```

这是减少分析量的工具，不是精确剪辑工具。开始位置依赖输入格式的定位能力，结果可能从附近的可定位点开始；需要精确切片请使用 `ffmpeg` 并按第 03、05 篇的时间参数验证。

## 统计 Packet 和 Frame

统计每条流的帧数：

```powershell
ffprobe -v error -count_frames -select_streams v:0 -show_streams -of json input.mp4
```

统计每条流的 Packet 数：

```powershell
ffprobe -v error -count_packets -show_streams -of json input.mp4
```

计数通常会让 ffprobe 读取更多输入数据，长文件或网络流可能耗时较长。结果会写入对应 Stream 的 `nb_read_frames` 或 `nb_read_packets` 等字段。

## 元数据、节目和章节

按需查询元数据：

```powershell
ffprobe -v error -show_entries "format_tags=title,creation_time:stream_tags=language,title" -of json input.mp4
```

MPEG-TS 等可能包含节目：

```powershell
ffprobe -v error -show_programs -of json input.ts
```

带章节的文件：

```powershell
ffprobe -v error -show_chapters -of json input.mp4
```

`-show_stream_groups` 用于更复杂的流组结构；普通 MP4 初学阶段可以跳过。

## 错误和底层数据

打开输入失败时，可以请求结构化错误段：

```powershell
ffprobe -v quiet -show_error -of json broken.mp4
```

下列选项用于底层分析，不是日常查询首选：

| 选项 | 用途 |
| --- | --- |
| `-show_data` | 输出 Packet 负载或 Codec Extra Data，内容可能非常大 |
| `-show_data_hash algorithm` | 输出负载或 Extra Data 的哈希 |
| `-sections` | 列出 ffprobe 的 Section 结构 |
| `-show_versions` | 输出程序和库版本 |
| `-show_pixel_formats` | 输出当前构建支持的像素格式 |

需要这些选项时先查当前构建：

```powershell
ffprobe -hide_banner -h full
ffprobe -hide_banner -sections
```

## 其他官方选项速查

日常查询不需要背下面这些选项，但它们在官方命令中有明确用途：

| 选项 | 用途和限制 |
| --- | --- |
| `-show_log loglevel` | 随 `-show_frames` 输出解码器日志；日志级别沿用 `-loglevel` |
| `-show_optional_fields`（`auto`/`always`/`never`） | 控制 JSON/XML 是否打印无效或不适用字段 |
| `-show_private_data` / `-private` | 显示格式相关的私有数据；默认开启，生成严格 XML 时可关闭 |
| `-show_program_version` | 只输出 ffprobe 程序版本段 |
| `-show_library_versions` | 输出各 FFmpeg 库版本段 |
| `-show_versions` | 同时输出程序和库版本 |
| `-show_pixel_formats` | 列出当前构建支持的像素格式 |
| `-bitexact` | 尽量产生与构建环境无关的确定性输出 |

不同 FFmpeg 版本会增加或调整选项。例如新版本官方文档可能出现 `-analyze_frames`；如果本机 `ffprobe -h full` 没有该选项，就不能直接使用。

## PowerShell 中交给程序处理

保存稳定 JSON：

```powershell
ffprobe -v error -show_format -show_streams -of json input.mp4 | Out-File -Encoding utf8 media.json
```

在 PowerShell 中直接读取：

```powershell
$media = ffprobe -v error -show_format -show_streams -of json input.mp4 | ConvertFrom-Json
$media.streams | Select-Object index,codec_type,codec_name,width,height,sample_rate
```

生产调用还应记录版本、退出码和必要的错误日志，并对 URL 中的用户名、密码、Token 做脱敏。不要用正则解析默认人类日志来代替 JSON。

## 查询决策表

| 你想知道什么 | 推荐命令组合 |
| --- | --- |
| 文件是什么容器 | `-show_format -of json` |
| 有哪些轨道 | `-show_streams -of json` |
| 第一条视频的编码和尺寸 | `-select_streams v:0 -show_entries stream=codec_name,width,height -of json` |
| 第一条音频的采样率和声道 | `-select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of json` |
| 选择语言/标题标签 | `-show_entries stream_tags=language,title -of json` |
| 某一小段 Packet | `-read_intervals "%+2" -show_packets` |
| 某一小段 Frame | `-read_intervals "%+2" -show_frames` |
| 是否能完整解码 | 使用 `ffmpeg -v error -i input -f null -`，不要只依赖 ffprobe |

推荐的日常顺序是：

```text
1. -show_format / -show_streams 看全貌
2. -select_streams 缩小到目标流
3. -show_entries 缩小字段
4. -of json 交给程序
5. 只有遇到时间、同步或损坏问题时才看 Packet/Frame
```

## 常见误区

- `ffprobe` 能读到容器头，不代表文件后半段一定能完整解码；
- `duration` 为 `N/A` 不自动等于损坏，实时流和管道经常没有总时长；
- `r_frame_rate` 不是所有场景下的真实播放 FPS；
- `-select_streams` 只改变显示范围，不能给 `ffmpeg` 输出做映射；
- `-show_entries` 只减少显示字段，不会修复输入或改变媒体；
- `-of json` 只改变输出格式，不会让探测更准确；
- Packet 是压缩数据，Frame 是解码结果，两者数量不必相同。

## 与 FFmpeg 的边界

先探测：

```powershell
ffprobe -v error -show_format -show_streams -of json input.mp4
```

再处理：

```powershell
ffmpeg -i input.mp4 -c copy output.mkv
```

如果要证明整个文件可以解码：

```powershell
ffmpeg -v error -i input.mp4 -map 0:v? -map 0:a? -f null -
```

`ffprobe` 的角色是提供输入事实；`ffmpeg` 的角色是处理媒体。两者都以当前版本和构建能力为准：

```powershell
ffprobe -version
ffprobe -h full
```

依据：[ffprobe 官方文档](https://ffmpeg.org/ffprobe.html)；[FFmpeg 官方命令文档](https://ffmpeg.org/ffmpeg.html)。
