---
title: FFmpeg 入门教程
createTime: '2026/08/31 10:00:00'
code: tffmpeg01
permalink: /tutorials/ffmpeg/
summary: 从认识工具、看懂媒体文件开始，逐步完成转封装、转码、流选择和结果验证。
description: 面向初学者的 FFmpeg 学习路径，先掌握少量高频命令，再按需要深入 Stream、Filter 和网络媒体。
order: 2
tags:
  - FFmpeg
  - ffprobe
  - 音视频
  - 入门教程
category: 音视频
showOnHome: false
---

这是一套按“先跑通，再理解，再排错”编排的 FFmpeg 教程。命令都按 Windows PowerShell 编写，`input.mp4`、`output.mp4` 和地址只是占位符。

## 先看懂总流程

可以把每次处理想成：先看容器里有什么，再决定 Stream Copy 还是转码，最后验收。

```mermaid
flowchart LR
  A[输入文件] --> B[ffprobe<br/>先确认事实]
  B --> C[ffmpeg<br/>选流并处理]
  C --> D{内容要改吗?}
  D -->|否| E[-c copy<br/>Stream Copy]
  D -->|是| F[Decode → Filter → Encode]
  E --> G[Muxer<br/>重新封装]
  F --> G
  G --> H[输出文件]
  H --> I[ffprobe + ffplay<br/>结构与播放验收]
```

| 图中节点 | 你需要确认的内容 |
| --- | --- |
| `ffprobe` | 容器、轨道、编码、时长是否可读 |
| `-map` | 输出需要哪些视频、音频、字幕 |
| `-c copy` | 内容不变时复制压缩包，避免无意义转码 |
| `Filter` | 缩放、裁剪、抽帧、叠加、调音量 |
| `Muxer` | 目标容器能不能装选中的流 |
| 验收 | 退出码、结构探测、完整解码、播放器分别检查 |

## 建议阅读顺序

不要一开始背参数。先用第 01 篇跑通一条命令，再用第 02 篇看懂输入，然后按任务往下走。

| 顺序 | 文档 | 这一篇解决的问题 |
| --- | --- | --- |
| 01 | [先跑通 FFmpeg](/tutorials/tffmpeg-guide/) | 三个程序分别做什么，第一条命令怎么写 |
| 02 | [看懂媒体文件](/tutorials/t1vdqkiht/) | 容器、编码、Stream 和常见音视频属性 |
| 随查 | [FFprobe 命令查询与理解](/tutorials/t2er6pk59/) | 查询容器、流、字段、Packet、Frame 和 JSON |
| 03 | [完成常见文件任务](/tutorials/t2qx7heah/) | 换容器、转码、缩放、截取、抽图、提取音频 |
| 04 | [选择需要的媒体流](/tutorials/t6loukxpw/) | 多轨时如何准确选择视频、音频和字幕 |
| 05 | [理解参数、滤镜与质量](/tutorials/t17xaopev/) | 参数写在哪、何时必须转码、CRF 和码率 |
| 深入 | [FFmpeg Filters：读懂 Filterchain 与 Filtergraph](/tutorials/tffmpeg-filters/) | 滤镜怎么连接，Logo、裁剪、分支怎么写 |
| 深入 | [FFmpeg Filters 进阶：Timeline、framesync 与 Audio](/tutorials/tffmpeg-filters-2/) | 按时间启用、运行中改参数、多输入同步与音频 |
| 深入 | [看懂 H.264 / H.265 码流](/tutorials/tffmpeg-bitstream/) | 关键帧、NAL、SPS/PPS，以及首帧延迟和 missing PPS |
| 最后 | [案例学习：常见任务与面试题](/tutorials/t19hdgc9e/) | 把前面的知识组合成可复用案例 |

## 开始前：确认工具

```powershell
ffmpeg -version
ffprobe -version
ffplay -version
```

`ffmpeg` 处理和输出，`ffprobe` 读取信息，`ffplay` 人工预览。编码器、滤镜和协议以执行机器为准：

```powershell
ffmpeg -hide_banner -encoders 2>&1 | Select-String "libx264|libx265|aac"
ffmpeg -hide_banner -filters 2>&1 | Select-String "scale|fps|overlay"
```

提示“不是内部或外部命令”时，先安装 FFmpeg 并把 `bin` 加入 PATH。不要把一台机器上的编码器名称当成所有机器都支持。第一条可运行的命令从第 01 篇开始。

## 本教程的命令约定

- 示例是 PowerShell 单行命令，不使用 Bash 的 `\` 续行符。
- 路径含空格时用引号，例如 `"D:\Media Files\input.mp4"`。
- 示例默认不使用 `-y` 覆盖文件；确认目标后再显式添加。实验目录里的样本文件除外。
- 批处理或服务调用应额外处理超时、取消、并发、磁盘空间和凭据脱敏。
- 退出码为 0 只说明进程没有报告失败；结构、完整解码和目标播放器仍需单独检查。

## 依据与边界

命令语义以 [FFmpeg CLI Documentation](https://ffmpeg.org/ffmpeg.html)、[ffprobe Documentation](https://ffmpeg.org/ffprobe.html)、[Filters Documentation](https://ffmpeg.org/ffmpeg-filters.html)、[Formats Documentation](https://ffmpeg.org/ffmpeg-formats.html) 和 [Protocols Documentation](https://ffmpeg.org/ffmpeg-protocols.html) 为准。本机当前验证基线为 FFmpeg 7.1.1 full build；不同版本或发行包的可用组件可能不同。

文档只提供学习和本地命令基线，不声称已经验证任何特定摄像机、生产服务器或浏览器链路。涉及 RTSP、HLS 和自动化时，请按最后的案例学习篇重新检查。
