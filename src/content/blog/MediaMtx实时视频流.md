---
title: 使用 MediaMTX 搭建实时 WebRTC 视频流服务
createTime: '2025/11/03 13:50:30'
code: rcpeh9s7
permalink: /article/rcpeh9s7/
tags:
  - MediaMTX
  - 视频流
cover: >-
  https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/b7bafc5044f86c9ee183e5411c75974e.jpg
---

MediaMTX（原名 `rtsp-simple-server`）是一个**零依赖、跨平台、高性能的实时流媒体服务器**，专为低延迟视频传输设计。它支持 RTSP、RTMP、WebRTC、HLS、SRT、MPEG-TS 等多种协议的**自动转换与中继**，可广泛应用于安防监控、远程巡检、无人机图传、直播推流等场景。

在实际项目中，MediaMTX 常作为 **IP 摄像头、NVR、编码器等设备与 Web 客户端之间的“协议翻译桥”**，将传统 RTSP 流转换为浏览器可原生播放的 WebRTC 或 HLS 流，实现**亚秒级延迟**的 Web 端实时预览。

本文将从**部署、配置、前端播放、API 控制、性能优化、安全建议**等多个维度，全面介绍如何使用 MediaMTX 构建一套稳定高效的视频流服务体系。

---

## 一、MediaMTX 核心特性与适用场景

### ✅ 核心能力

| 特性 | 说明 |
|------|------|
| **多协议支持** | 输入：RTSP、RTMP、WebRTC、SRT、HLS、MPEG-TS<br>输出：RTSP、RTMP、WebRTC、HLS、MPEG-TS |
| **协议自动转换** | 同一路流可同时通过 WebRTC（低延迟）、HLS（兼容性好）、RTMP（推流）等方式访问 |
| **热重载配置** | 修改 `mediamtx.yml` 后，可通过 API 或文件监听自动生效，**无需重启服务** |
| **动态路径管理** | 支持通过 REST API 动态添加、删除、修改流路径，适合设备频繁增减的场景 |
| **录制与回放** | 可将实时流录制为 `fMP4` 或 `MPEG-TS` 文件，支持通过 HTTP 提供 VOD 点播 |
| **状态监控** | 提供 `/metrics`（Prometheus 格式）和 `/api` 接口，便于集成监控系统 |
| **轻量级** | 单二进制文件，无外部依赖，资源占用低，适合边缘部署 |

### 🎯 典型应用场景

- **Web 端低延迟监控**：将 RTSP 摄像头转为 WebRTC，实现 300~800ms 延迟
- **多平台兼容播放**：一套流同时支持 Web（WebRTC/HLS）、移动端（RTMP）、本地客户端（RTSP）
- **流媒体中转层**：作为 NVR 与云平台之间的协议转换网关
- **直播推流网关**：将多路监控流汇聚后推送到抖音、B站等直播平台
- **边缘计算节点**：在 IoT 设备上运行，实现本地拉流 + AI 推理 + 上云分发

> 🔗 **官网文档**：[https://mediamtx.org/docs](https://mediamtx.org/docs)

---

## 二、Windows 快速部署

### 1. 下载与解压

前往 GitHub 发布页下载最新版本：

👉 [https://github.com/bluenviron/mediamtx/releases](https://github.com/bluenviron/mediamtx/releases)

选择适用于 Windows 的压缩包（如 `mediamtx_v1.15.3_windows_amd64.zip`），解压后得到：

- `mediamtx.exe`：主程序
- `mediamtx.yml`：默认配置文件

### 2. 启用 API 与 Metrics

修改 `mediamtx.yml`，启用 REST API 和监控接口：

```yaml
# 启用 REST API（用于动态配置）
api: yes
apiAddress: :9997
apiEncryption: no  # 生产环境建议启用 TLS

# 启用 Prometheus 监控指标
metrics: yes
metricsAddress: :9998

# 启用 WebRTC（用于低延迟播放）
webrtc: yes
webrtcAddress: :8889
webrtcAdditionalHosts: []  # 可绑定域名或 IP
```

### 3. 启动服务

打开命令行，运行：

```bash
mediamtx.exe mediamtx.yml
```

服务启动后，可通过以下地址验证：

- `http://localhost:9997` → API 状态页
- `http://localhost:9998/metrics` → Prometheus 指标
- `http://localhost:8889` → WebRTC 服务页

---

## 三、接入 RTSP 摄像头（以大华为例）

### 1. 获取 RTSP 地址

大华相机的 RTSP 地址格式通常为：

```
rtsp://用户名:密码@IP:554/cam/realmonitor?channel=通道号&subtype=码流类型
```

- `channel`：通道号，从 1 开始
- `subtype`：码流类型，0=主码流（高画质），1=子码流（低码率）

示例：

```
rtsp://admin:admin12345@172.17.234.202:554/cam/realmonitor?channel=2&subtype=1
```

> ⚠️ **注意**：部分大华设备需在 Web 界面开启 RTSP 服务，并确保用户名密码正确。

### 2. 配置流路径

在 `mediamtx.yml` 中添加：

```yaml
paths:
  cam_parking_01:  # 自定义路径名，用于访问
    source: rtsp://admin:admin12345@172.17.234.202:554/cam/realmonitor?channel=2&subtype=1
    # 可选：设置超时时间
    readTimeout: 10s
    # 可选：启用录制
    record: yes
    recordPath: ./recordings/cam_parking_01/%Y-%m-%d_%H-%M-%S
    recordFormat: fmp4
```

> ✅ **路径名建议**：使用 `cam_地点_编号` 格式，便于管理。

### 3. 启动服务

```bash
mediamtx.exe mediamtx.yml
```

启动后，MediaMTX 会自动从指定 RTSP 地址拉流，并等待客户端连接。

---

## 四、前端 WebRTC 播放（低延迟推荐）

WebRTC 是目前**延迟最低**（通常 300~800ms）的 Web 播放方案，推荐用于实时监控。

### 1. 播放页面（单摄像头）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>MediaMTX WebRTC 实时监控</title>
    <style>
        body {
            margin: 0;
            font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
            background: #0b0b0b;
            color: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
        }
        video {
            width: 80%;
            max-width: 960px;
            aspect-ratio: 16/9;
            background: #000;
            border-radius: 12px;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
        }
        button {
            margin-top: 20px;
            padding: 10px 20px;
            font-size: 16px;
            border: none;
            border-radius: 8px;
            background: #4caf50;
            color: white;
            cursor: pointer;
        }
        button:hover {
            background: #43a047;
        }
    </style>
</head>
<body>
    <h2>实时监控 - cam_parking_01</h2>
    <video id="video" autoplay muted playsinline></video>
    <button id="playBtn">▶️ 开始播放</button>

    <script>
        // 自动匹配协议（HTTP → WS, HTTPS → WSS）
        const MEDIAMTX_BASE = window.location.protocol + '//' + window.location.hostname + ':8889';
        const STREAM_PATH = 'cam_parking_01'; // 与配置文件一致

        async function startPlay() {
            const video = document.getElementById('video');
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.addTransceiver('audio', { direction: 'recvonly' }); // 如有音频

            pc.ontrack = (event) => {
                video.srcObject = event.streams[0];
            };

            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                const response = await fetch(`${MEDIAMTX_BASE}/${STREAM_PATH}/whep`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/sdp' },
                    body: offer.sdp
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const answer = await response.text();
                await pc.setRemoteDescription({ type: 'answer', sdp: answer });
            } catch (err) {
                console.error('播放失败:', err);
                alert('播放失败: ' + err.message);
            }
        }

        document.getElementById('playBtn').addEventListener('click', startPlay);
    </script>
</body>
</html>
```

### 2. 部署播放页

将 HTML 文件放入 MediaMTX 同级目录，或通过 Nginx/Apache 托管。

访问：`http://your-server:8889/your-page.html`

---

## 五、REST API 动态管理流路径

MediaMTX 提供了完整的 **Control API**，支持运行时动态管理配置，无需重启服务。

> 🔗 **API 文档**：[https://mediamtx.org/docs/references/control-api](https://mediamtx.org/docs/references/control-api)

### 1. 添加新路径（POST）

```bash
curl -X POST http://localhost:9997/v3/config/paths/add/cam_parking_02 \
  -H "Content-Type: application/json" \
  -d '{
    "source": "rtsp://admin:12345@192.168.1.11:554/Streaming/Channels/101"
  }'
```

### 2. 查询所有路径（GET）

```bash
curl http://localhost:9997/v3/paths/list
```

返回示例：

```json
[
  {
    "name": "cam_parking_01",
    "state": "ready",
    "bytesReceived": 123456,
    "bytesSent": 789012,
    "numReaders": 1
  }
]
```

### 3. 删除路径（DELETE）

```bash
curl -X DELETE http://localhost:9997/v3/config/paths/delete/cam_parking_02
```

> ✅ **适用场景**：设备动态接入、临时调试、自动化测试。

---

## 六、高级配置与优化建议

### 1. 启用 HLS（兼容性更好）

```yaml
hls:
  enabled: yes
  address: :8888
  variant: lowLatency
  segmentDuration: 1s
  partDuration: 200ms
  segmentCount: 3
```

播放地址：`http://your-server:8888/cam_parking_01/index.m3u8`

> ⚠️ 延迟较高（通常 2~5s），但兼容性最好，适合移动端。

### 2. 多路流配置模板

```yaml
# 使用模板简化配置
<<loop "i" 1 10>>
cam_parking_{{ $i }}:
  source: rtsp://admin:admin12345@172.17.234.20{{ $i }}:554/cam/realmonitor?channel=1&subtype=1
<</loop>>
```

> ⚠️ 需用脚本预处理生成最终 YAML。

### 3. 资源监控与告警

- 通过 `/metrics` 接入 Prometheus + Grafana
- 监控指标：`mediamtx_bytes_received_total`、`mediamtx_paths_count`
- 设置告警：流中断、连接数突降

---

## 七、安全建议

| 风险 | 建议 |
|------|------|
| API 未授权访问 | 启用 `apiEncryption: yes`，使用 HTTPS + Token |
| RTSP 密码泄露 | 避免在前端暴露完整 RTSP URL，使用路径名代替 |
| WebRTC 未认证 | 结合反向代理（Nginx）实现 JWT 或 Cookie 鉴权 |
| 服务暴露公网 | 使用防火墙限制 IP，或部署在内网 + 隧道访问 |

---

## 八、常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 无法播放 | 摄像头 RTSP 地址错误 | 使用 VLC 测试 RTSP 是否可播放 |
| 延迟高 | 使用了 HLS | 改用 WebRTC |
| 连接中断 | 网络不稳定或超时 | 调整 `readTimeout`、`writeTimeout` |
| 多路卡顿 | CPU/带宽不足 | 降低码率、使用子码流、升级硬件 |
| API 无响应 | 防火墙拦截 | 检查端口 9997 是否开放 |

---

## 九、结语

MediaMTX 是一个**简单、高效、可靠的流媒体中转工具**，特别适合需要将传统 RTSP 摄像头接入 Web 端的项目。通过合理的配置与 API 集成，可以快速构建一套支持**多协议、低延迟、可扩展**的视频流服务体系。

在后续文章中，我们将探讨：
- 如何与 Spring Boot 项目集成
- 实现 ONVIF 设备自动发现与接入
- 视频流录制与按时间回放
- 多路流的负载均衡与高可用部署
