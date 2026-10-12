---
title: Docker安装Ollama
createTime: '2026/03/01 19:23:46'
code: b2lb91htk
permalink: /blog/b2lb91htk/
tags:
  - Docker
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250605165730.jpg
---

Ollama 服务负责加载模型并提供推理接口。容器启动成功只说明服务在运行，第一次使用模型还需要下载模型文件。

## 启动本地服务

先确认 Docker 已启动。创建 `compose.yaml`，下面从 CPU 模式开始：

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "127.0.0.1:11434:11434"
    volumes:
      - ollama_models:/root/.ollama

volumes:
  ollama_models:
```

```bash
docker compose up -d
docker compose exec ollama ollama --version
docker compose exec ollama ollama pull llama3.2:1b
docker compose exec ollama ollama run llama3.2:1b
```

输入问题后按回车，输入 `/bye` 退出交互。模型下载需要网络、磁盘空间和足够内存；速度取决于硬件、模型大小和上下文长度。

容器已经运行 `ollama serve`，不要在同一容器内再次启动服务。`latest` 会变化，长期使用应记录版本与镜像摘要。

## 从程序访问

PowerShell 中执行：

```powershell
$payload = @{
    model = 'llama3.2:1b'
    prompt = '用一句话解释视频转码'
    stream = $false
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/generate' -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($payload))
```

返回 JSON 中的 `response` 是生成文本。`stream=false` 表示等本次生成结束后一次返回；流式模式的解析方式不同。

## 管理模型和故障定位

```bash
docker compose exec ollama ollama list
docker compose exec ollama ollama ps
docker compose exec ollama ollama show llama3.2:1b
docker compose exec ollama ollama stop llama3.2:1b
docker compose logs --tail=100 ollama
```

`stop` 卸载正在运行的模型，保留下载文件。删除下载文件用 `ollama rm 模型名`。

NVIDIA GPU 需要驱动和 NVIDIA Container Toolkit，并在创建容器时授予 GPU；不是在 `ollama run` 后添加 `--gpu`。按 [Ollama Docker 官方说明](https://docs.ollama.com/docker) 配置。宿主机程序访问 localhost；同一 Compose 网络里的程序访问 `http://ollama:11434`。
