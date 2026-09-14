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

这套教程从本地视频处理开始：查看文件、换容器、转码、选音轨，再读滤镜和码流。初次使用可以从第 01 篇的测试素材动手；已有具体任务，可以直接查案例篇。

## 先看懂总流程

先用 `ffprobe` 确认输入，再按输出要求选择流和处理方式。下面是文件处理的常见流程；复制或转码的选择针对每条流，视频和音频可以采用不同方式。

```mermaid
flowchart LR
  A[输入文件] --> B[ffprobe<br/>先确认事实]
  B --> C[ffmpeg<br/>选流并处理]
  C --> D{该流需要改编码<br/>或处理画面、声音吗?}
  D -->|否，且容器兼容| E[-c copy<br/>Stream Copy]
  D -->|是| F[Decode → Filter 可选 → Encode]
  E --> G[Muxer<br/>重新封装]
  F --> G
  G --> H[输出文件]
  H --> I[探测结构 → 完整解码 → 播放检查]
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

前五篇连续阅读，后五篇按问题查阅。下面的顺序与章节导航一致。

| 顺序 | 文档 | 这一篇解决的问题 |
| --- | --- | --- |
| 01 | [先跑通 FFmpeg](/tutorials/tffmpeg-guide/) | 三个程序分别做什么，第一条命令怎么写 |
| 02 | [看懂媒体文件](/tutorials/t1vdqkiht/) | 容器、编码、Stream 和常见音视频属性 |
| 03 | [完成常见文件任务](/tutorials/t2qx7heah/) | 换容器、转码、缩放、截取、抽图、提取音频 |
| 04 | [选择需要的媒体流](/tutorials/t6loukxpw/) | 多轨时如何准确选择视频、音频和字幕 |
| 05 | [理解参数、滤镜与质量](/tutorials/t17xaopev/) | 参数写在哪、何时必须转码、CRF 和码率 |
| 06 | [Filterchain 与 Filtergraph](/tutorials/tffmpeg-filters/) | Filter、Pad、Link Label 与分支 |
| 07 | [Timeline editing、framesync 与 Audio Filters](/tutorials/tffmpeg-filters-2/) | enable、runtime command、多输入同步和音频处理 |
| 08 | [FFprobe 查询手册](/tutorials/t2er6pk59/) | 容器、流、Packet、Frame 和 JSON，随用随查 |
| 09 | [H.264 / H.265 码流](/tutorials/tffmpeg-bitstream/) | 关键帧、NAL、参数集与首帧排查 |
| 10 | [常见任务与排障案例](/tutorials/t19hdgc9e/) | 转码、切片、拼接、HLS 与 RTSP |

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

找不到命令时，从 [FFmpeg 官方下载页](https://ffmpeg.org/download.html) 查看 Windows 构建入口，将解压后的 `bin` 目录加入 PATH，再打开终端检查版本。可用组件以当前构建为准。

## 本教程的命令约定

- 示例是 PowerShell 单行命令，不使用 Bash 的 `\` 续行符。
- 路径含空格时用引号，例如 `"D:\Media Files\input.mp4"`。
- 示例默认不使用 `-y` 覆盖文件；确认目标后再显式添加。实验目录里的样本文件除外。
- 批处理或服务调用应额外处理超时、取消、并发、磁盘空间和凭据脱敏。
- 退出码为 0 只说明进程没有报告失败；结构、完整解码和目标播放器仍需单独检查。

## 依据与边界

命令语义依据 [FFmpeg CLI](https://ffmpeg.org/ffmpeg.html)、[ffprobe](https://ffmpeg.org/ffprobe.html)、[Filters](https://ffmpeg.org/ffmpeg-filters.html)、[Formats](https://ffmpeg.org/ffmpeg-formats.html) 和 [Protocols](https://ffmpeg.org/ffmpeg-protocols.html)。官网在线文档随开发版本更新；本轮按 [FFmpeg n7.1.1 官方文档源码](https://github.com/FFmpeg/FFmpeg/tree/n7.1.1/doc) 核对，并使用本机 7.1.1 full build 检查代表性命令。

文中的命令是依据上述选项组合的演示，示意结构会单独注明；它们不是官方逐字示例，也不是生产运行记录。码流定义另附 ITU-T 和 IETF 规范来源。

文档只提供学习和本地命令基线，不声称已经验证任何特定摄像机、生产服务器或浏览器链路。涉及 RTSP、HLS 和自动化时，请按最后的案例学习篇重新检查。
