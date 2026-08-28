---
title: FFmpeg 音视频处理教程
createTime: '2026/08/26 13:51:37'
code: tffmpeg01
permalink: /tutorials/ffmpeg/
summary: 用一条清晰主线掌握媒体模型、处理链路、流选择、参数作用域、常用案例与故障定位。
description: 面向 Windows 与工程实践的 FFmpeg 学习专栏，命令可直接在 PowerShell 中执行。
order: 2
tags:
  - tutorial
  - FFmpeg
  - ffprobe
  - 音视频
  - RTSP
category: 音视频
showOnHome: false
---

这套教程不按官方手册的篇幅逐段翻译，而是围绕一条可执行的工作流组织内容：

```text
先探测输入 → 明确目标 → 选择流 → 决定复制或转码 → 设置参数 → 执行 → 验证输出
```

## 章节结构

| 顺序 | 章节 | 解决的问题 |
| --- | --- | --- |
| 1 | 核心知识与学习指南 | 应该学什么、怎样读命令、怎样从需求写出命令 |
| 2 | 媒体模型与基础概念 | 容器、编码、流、Packet、Frame、时间戳分别是什么 |
| 3 | 处理链路与转码 | Demux、Decode、Filter、Encode、Mux 如何串起来 |
| 4 | 流选择与映射 | 多音轨、多字幕、多输入时如何使用 `-map` |
| 5 | 参数体系与命令结构 | 参数为什么放在不同位置，常用参数如何组合 |
| 6 | 常用案例与故障定位 | 转封装、压缩、截图、切片、合成、HLS、RTSP 与验证 |

建议按顺序阅读前 5 章，再把第 6 章当作任务手册使用。遇到陌生参数时，以本机 `ffmpeg -h full` 和官方文档为准，不需要背诵全部选项。

## 开始前的检查

确认三个程序均已加入 `PATH`：

```powershell
ffmpeg -version
ffprobe -version
ffplay -version
```

再确认常用编码器是否存在：

```powershell
ffmpeg -hide_banner -encoders | Select-String "libx264|hevc_nvenc|aac"
```

不同构建包含的编码器、设备和硬件加速能力可能不同。教程中的 `libx264` 不是所有发行包都必然提供；如果命令提示 `Unknown encoder`，先检查构建能力，不要直接判断输入文件损坏。

## 生成可复现练习素材

以下命令不依赖外部视频，会生成 10 秒测试画面与正弦音频：

```powershell
ffmpeg -hide_banner -f lavfi -i "testsrc2=size=1280x720:rate=30" -f lavfi -i "sine=frequency=1000:sample_rate=48000" -t 10 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest sample.mp4
```

生成后先探测，不要直接开始转码：

```powershell
ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels -of json sample.mp4
```

## 文档约定

- 示例按 Windows PowerShell 编写，避免不可直接粘贴的 Bash 反斜杠续行。
- `input.mp4`、`output.mp4` 与 RTSP 地址都是占位符，应替换为实际值。
- 真实账号和密码不要写进文档、脚本、Git 提交或共享日志。
- 除非明确需要批量覆盖，示例不默认使用 `-y`，避免误覆盖已有文件。
- 命令成功退出不等于结果正确；每个输出都应使用 `ffprobe` 或实际播放器验证。

## 官方资料

- [ffmpeg 命令行文档](https://ffmpeg.org/ffmpeg.html)
- [ffprobe 文档](https://ffmpeg.org/ffprobe.html)
- [Filter 文档](https://ffmpeg.org/ffmpeg-filters.html)
- [Format 文档](https://ffmpeg.org/ffmpeg-formats.html)
- [Protocol 文档](https://ffmpeg.org/ffmpeg-protocols.html)

官方文档会随版本演进；本教程负责建立稳定的理解框架，具体参数仍应结合实际 FFmpeg 版本核对。
