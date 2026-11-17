# ZLM 协议教程示例

可执行源码唯一维护在 `public/examples/zlm-protocols/zlm_core.py`，由网站提供下载。教程位于 `src/content/tutorial/zlm/`。

Python 3.11+，无需 pip 安装。ZLM 已运行；`inspect` / `frame` 需要 ffprobe / FFmpeg。详细环境变量、模拟源和命令见教程第 00 篇。

示例只做单机教学，不提供公开的任意 URL 拉流服务；管理 API secret 仅从环境变量读取。GB 篇运行 PS/RTP 媒体演示，明确不冒充完整 SIP 平台。

2026-10-26 实测：Windows / Python 3.11 / FFmpeg 8.0 / 已安装的 ZLM，隔离端口 HTTP 29688、RTSP 29654、RTMP 29635、RTC 29690。RTSP/RTMP/FLV/HLS 四种 pull 均实际取得 640×360 RGB 图像并精确关闭代理；主动 RTSP、PS/RTP 同样解码成功，RTP 接收器归零，实验进程全部退出。ZLM 自带 WebRTC 页实播 318 帧。教程端口是可替换参数。

网站 `npm run check` 和 `npx astro build` 通过。未验证真实厂商国标互通、完整 SIP 示例、音频、HTTPS、跨机 NAT 或容量；Linux 命令属于跨平台用法说明，媒体实验在 Windows 执行。
