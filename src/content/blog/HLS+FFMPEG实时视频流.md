---
title: HLS+FFMPEG实时视频流
createTime: '2026/03/01 19:23:46'
code: b2ow0cdtq
permalink: /blog/b2ow0cdtq/
summary: 使用 FFmpeg 将摄像头 RTSP 转为 HLS，并通过 Spring Boot 提供静态映射、进程守护与浏览器播放。
tags:
  - 视频流
  - HLS
  - FFmpeg
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/a496989751bfb3e14c29f07b9ec99116.jpg
---

HLS 用 HTTP 分发播放列表和媒体分片。先用 FFmpeg 生成一条 HLS，再用浏览器播放，最后把测试源换成相机。下面命令在 Windows PowerShell 中执行，需要 FFmpeg、Python 3 和能访问 CDN 的浏览器。

## 生成可播放的测试源

在空目录创建 `hls` 文件夹：

```powershell
New-Item -ItemType Directory -Path hls -Force | Out-Null
ffmpeg -f lavfi -i "testsrc2=size=640x360:rate=25" -t 12 -an -c:v libx264 -pix_fmt yuv420p -g 50 -keyint_min 50 -sc_threshold 0 -f hls -hls_time 2 -hls_list_size 6 -hls_flags independent_segments+temp_file -hls_segment_filename "hls/segment_%03d.ts" "hls/index.m3u8"
```

这会生成约 12 秒的画面。`-g 50` 配合 25 FPS 和关闭场景切换，安排约 2 秒一个关键帧；HLS 在合适的关键帧附近切片。`independent_segments` 声明各分片可独立解码，不会自己创建关键帧。

打开 `hls/index.m3u8`，应能看到 `#EXTM3U` 和 `segment_000.ts` 等文件名。播放列表不是视频文件，它告诉播放器去哪里下载分片。

## 创建播放器

在 `hls` 文件夹同级保存 `player.html`：

```html
<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HLS 练习</title>
<video id="video" controls muted playsinline style="width:100%;max-width:800px"></video>
<p id="status">正在加载</p>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js"></script>
<script>
const video = document.getElementById('video');
const status = document.getElementById('status');
const url = './hls/index.m3u8';
let hls;
if (video.canPlayType('application/vnd.apple.mpegurl')) {
  video.src = url;
} else if (window.Hls && Hls.isSupported()) {
  hls = new Hls();
  hls.loadSource(url);
  hls.attachMedia(video);
  hls.on(Hls.Events.ERROR, (_, data) => {
    if (data.fatal) { status.textContent = '播放失败：' + data.type; hls.destroy(); }
  });
} else {
  status.textContent = '当前浏览器不支持，或播放器脚本未加载';
}
video.addEventListener('loadedmetadata', () => { status.textContent = '已加载，请点击播放'; });
video.addEventListener('error', () => { status.textContent = '媒体加载失败，请检查网络请求'; });
window.addEventListener('pagehide', () => { hls?.destroy(); });
</script>
</html>
```

启动 HTTP 服务，保持终端运行：

```powershell
python -m http.server 8090 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8090/player.html`，点击播放。不要直接双击 HTML 使用 `file://`，播放器需要通过 HTTP 下载播放列表与分片。

## 替换为相机 RTSP

先用 VLC 或 ffprobe 确认相机地址、账号和编码。将地址放到当前 PowerShell 进程的变量中，完整 URI 作为一个参数传入，避免 `&` 被当作命令符号：

```powershell
$env:RTSP_URL = 'rtsp://用户名:密码@相机IP:554/实际路径'
ffprobe -v error -rtsp_transport tcp -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate -of json $env:RTSP_URL
```

相机输出 H.264 且满足目标浏览器的编码要求时，可尝试只封装：

```powershell
ffmpeg -rtsp_transport tcp -i $env:RTSP_URL -map 0:v:0 -c:v copy -an -f hls -hls_time 2 -hls_list_size 6 -hls_flags delete_segments+temp_file -hls_segment_filename "hls/live_%03d.ts" "hls/index.m3u8"
```

这条命令持续运行，Ctrl+C 停止。复制码流不会改变 GOP，实际分片时长可能超过 2 秒。源为 H.265 或浏览器无法解码时，用 `-c:v libx264 -pix_fmt yuv420p -r 25 -g 50 -sc_threshold 0` 替换 `-c:v copy`，代价是持续转码开销。

相机的 channel 表示通道，subtype 通常表示某通道的主/子码流，具体 URI 以厂商或 ONVIF 返回结果为准，不能把“通道 1、通道 2”当作“主码流、子码流”。

## 排查顺序

1. ffprobe 能否拉取源：排查地址、认证、编码和网络。
2. FFmpeg 是否生成 m3u8 和 TS：看退出码与错误日志。
3. 浏览器 Network 中列表及分片是否返回 200：排查 HTTP 路径、跨域和缓存。
4. 文件能下载但不能播放：检查编码、浏览器能力和 hls.js 错误。

HLS 的延迟来自 GOP、分片、网络与缓冲。滑动播放列表和删除分片用于直播窗口，不能直接当作长期录像归档。多路接入、自动重连和容量规划应在单路流程确认后另行实现。

参考：[FFmpeg HLS muxer](https://ffmpeg.org/ffmpeg-formats.html#hls)、[hls.js](https://github.com/video-dev/hls.js)。需要流媒体服务器统一接入时，可继续阅读 [ZLMediaKit 入门](/blog/zlmediakit-start/) 或 [MediaMTX 入门](/blog/b2cajl4xw/)。
