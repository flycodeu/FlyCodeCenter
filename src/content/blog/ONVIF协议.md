---
title: ONVIF协议
createTime: '2026/03/01 19:23:46'
code: b1cqxk55k
permalink: /blog/b1cqxk55k/
tags:
  - MediaMTX
  - 视频
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/3e5bf05d61c2bf0f032bcf6a33568d4b.jpg
---

ONVIF 提供设备发现、配置、媒体地址查询与控制。它帮你拿到 RTSP 地址，但视频帧通常通过后续 RTSP/RTP 链路传输。

## 从设备到视频地址

```mermaid
flowchart LR
  D[设备服务地址] --> S[GetServices 或 GetCapabilities]
  S --> M[Media 或 Media2 地址]
  M --> P[GetProfiles]
  P --> U[选定 Profile 后 GetStreamUri]
  U --> V[RTSP 播放或拉流]
```

1. 在设备页面启用 ONVIF，准备有权限的 ONVIF 用户；它可能与网页账号不同。
2. 使用设备配置或 WS-Discovery 返回的服务地址，不能假定端口一定是 80。
3. 查询设备支持的服务和版本，使用返回的媒体服务 XAddr。
4. 读取 Profile 的 token、源配置、分辨率和编码，再选择目标 Profile。
5. 调用 GetStreamUri，随后用播放器验证这个 URI 能否打开。

Media 与 Media2 的操作结构不同，不能把 Media1 XML 直接发给 Media2 地址。NVR 的设备、通道和 Profile 也不是同一个对象；token 是不透明标识，不应提取末尾数字当通道号，或凭返回顺序指定主/子码流。

## 读懂一次 SOAP 请求

下面是 Media1 的 GetProfiles 请求正文，不含认证头。它用于理解消息结构，不能直接作为所有设备的可用请求：

```xml
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
  <s:Header/>
  <s:Body>
    <trt:GetProfiles/>
  </s:Body>
</s:Envelope>
```

SOAP 1.2 使用 `application/soap+xml`，action 按操作 WSDL 设置；前缀名称可以变化，解析 XML 要按命名空间 URI 和局部名称匹配。HTTP 200 中仍可能包含 SOAP Fault，必须检查 Body。

## UsernameToken 的摘要

设备可能要求 HTTP Digest、WS-Security UsernameToken 或组合认证，按设备支持情况处理。UsernameToken PasswordDigest 的计算是：

```text
Base64(SHA1(原始Nonce字节 + Created的UTF-8字节 + 密码的UTF-8字节))
```

Nonce 在消息中另外编码成 Base64；摘要计算用原始随机字节，不能用它的 Base64 文本。Created 使用 UTC，并同步设备与电脑时间。每次请求重新生成随机 Nonce，不写死摘要。

构造 XML 时通过 XML 库设置元素文本，避免直接拼接带 `&`、`<` 的用户名或 token。解析器禁用外部实体；HTTP 请求设置超时，关闭响应资源。日志不打印认证头、密码和完整带凭据的 RTSP URI。

## 自己动手验证

按 [相机接入教程](/tutorials/t1ya3tyeg/) 中的设备准备、认证和 Profile 查询步骤操作。拿到实际 URI 后，再按 [ZLMediaKit 接入与播放](/blog/zlmediakit-start/) 接入服务器。

排查顺序为：服务地址可达 → 时间与认证 → SOAP Fault → 返回的媒体服务地址 → Profile 与编码 → RTSP 拉流。ONVIF 查询成功但没有画面时，继续查 RTSP 用户权限、端口、传输方式和解码支持。

参考：[ONVIF Media 规范](https://www.onvif.org/specs/srv/media/ONVIF-Media-Service-Spec-v210.pdf)、[Core 规范](https://www.onvif.org/specs/core/ONVIF-Core-Specification-v210.pdf)。
