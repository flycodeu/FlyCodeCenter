---
title: FFmpeg 媒体处理工程参考
createTime: '2026/08/26 13:51:37'
code: tffmpeg01
permalink: /tutorials/ffmpeg/
summary: FFmpeg 媒体对象、处理链路、流映射、命令作用域与运行验收的工程参考。
description: FFmpeg 处理任务的设计约束、命令接口、案例基线与故障处置文档。
order: 2
tags:
  - FFmpeg
  - ffprobe
  - 音视频
  - RTSP
  - 设计文档
category: 音视频
showOnHome: false
---

本系列用于文件处理、实时输入和自动化任务的方案设计与运行审计。文档覆盖媒体对象、数据路径、Stream 映射、参数作用域和结果验收，不复述完整的官方参数手册。命令行为以执行节点的 FFmpeg 版本、构建配置和组件帮助为准。

```text
输入探测 → 目标约束 → Stream 选择 → 复制或转码 → 参数绑定 → 执行 → 输出验收
```

## 文档范围

| 文档 | 内容边界 | 主要产出 |
| --- | --- | --- |
| [处理设计原则与命令模型](/tutorials/tffmpeg-guide/) | 输入事实、处理规格、输出契约 | 可审计的命令结构 |
| [媒体对象模型与时间语义](/tutorials/t1vdqkiht/) | 容器、编码、Stream、Packet、Frame、时间戳 | 输入媒体描述 |
| [媒体处理链路与转码策略](/tutorials/t2qx7heah/) | Demux、Decode、Filter、Encode、Mux | Copy、Encode 与硬件路径决策 |
| [流选择与输出映射规范](/tutorials/t6loukxpw/) | 自动选择、`-map`、Specifier、Filtergraph 输出 | 确定的输出 Stream 集合 |
| [参数作用域与命令接口](/tutorials/t17xaopev/) | Global、Input、Output、Per-stream 参数 | 参数位置与进程调用约束 |
| [任务案例与故障处置](/tutorials/t19hdgc9e/) | 文件任务、HLS、RTSP、解码验证 | 命令基线与分层诊断路径 |

## 运行环境基线

命令处理至少需要 `ffmpeg` 与 `ffprobe`；人工播放或预览场景再提供 `ffplay`。版本信息属于运行记录的一部分：

```powershell
ffmpeg -version
ffprobe -version
ffplay -version
```

编码器能力以当前构建的列表为准：

```powershell
ffmpeg -hide_banner -encoders | Select-String "libx264|hevc_nvenc|aac"
```

不同发行包包含的编码器、设备和硬件加速能力并不一致。`libx264`、`hevc_nvenc` 等名称只有在当前构建的能力列表中出现时才可用；`Unknown encoder` 表示编码器不可用或名称错误，与输入媒体是否损坏无直接关系。

## 基准样例

以下命令生成 10 秒视频、音频基准样例，不依赖外部媒体：

```powershell
ffmpeg -hide_banner -f lavfi -i "testsrc2=size=1280x720:rate=30" -f lavfi -i "sine=frequency=1000:sample_rate=48000" -t 10 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest sample.mp4
```

基准结构：

```powershell
ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels -of json sample.mp4
```

## 命令约定

- 示例按 Windows PowerShell 编写，不使用 Bash 反斜杠续行。
- `input.mp4`、`output.mp4` 与 RTSP 地址均为占位符。
- 凭据不得写入文档、脚本、Git 提交或未脱敏日志。
- 示例不默认使用 `-y`；自动化覆盖策略应由调用方显式声明。
- 退出码仅表示进程结果；输出仍需经过结构探测、解码或播放器验收。

## 编辑能力边界

| 能力 | 当前状态 | 设计理由 |
| --- | --- | --- |
| Mermaid 图表缩放、滚动 | 支持 | 只影响当前查看器，不改变文章内容 |
| Mermaid 源码临时编辑与预览 | 支持 | 适合验证布局和语法，关闭窗口后自动丢弃 |
| Markdown 在线编辑、保存和发布 | 不引入 | 需要鉴权、保存 API、并发冲突、版本审计和发布流水线；当前站点是静态内容模型 |
| FFmpeg 命令在线执行 | 不引入 | 需要隔离进程、文件配额、网络策略和凭据边界，不能由轻量编辑器替代 |

当前编辑能力限定在 Mermaid 预览层。文章内容仍通过仓库 Markdown 变更和现有构建流程发布。

## 依据与版本边界

命令语义按 2026-08-28 的 FFmpeg 在线文档复核。FFmpeg 持续开发，运行记录仍以 `ffmpeg -version`、构建配置和组件级 `-h` 输出为准。

- 命令结构、选流、`-map`、Stream Copy、`-ss`：[ffmpeg 官方文档](https://ffmpeg.org/ffmpeg.html)
- 容器、concat、HLS 与分片：[Format 官方文档](https://ffmpeg.org/ffmpeg-formats.html)
- `scale`、`fps`、`overlay`、`amix`：[Filter 官方文档](https://ffmpeg.org/ffmpeg-filters.html)
- RTSP 与 `rtsp_transport`：[Protocol 官方文档](https://ffmpeg.org/ffmpeg-protocols.html)
- 探测字段与输出格式：[ffprobe 官方文档](https://ffmpeg.org/ffprobe.html)

以下资料只补充编码实践和播放兼容性，不覆盖 FFmpeg 的命令语义：

- [FFmpeg Encoding and Editing Course](https://slhck.info/ffmpeg-encoding-course/)：编码与码率控制的实践背景
- [CRF Guide](https://slhck.info/video/2017/02/24/crf-guide.html)：理解 CRF 的使用边界
- [MDN 视频编码指南](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)：浏览器兼容性
- [NVIDIA FFmpeg 硬件加速指南](https://docs.nvidia.com/video-technologies/video-codec-sdk/13.1/ffmpeg-with-nvidia-gpu/index.html)：NVDEC、NVENC 与 GPU 滤镜链路

本地结果与文档不一致时，差异记录包含完整版本、构建配置、最小复现命令和对应组件文档。
