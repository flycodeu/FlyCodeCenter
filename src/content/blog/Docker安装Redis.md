---
title: Docker安装Redis
createTime: '2026/03/01 19:23:46'
code: b5v3zffdg
permalink: /blog/b5v3zffdg/
tags:
  - Docker
  - Redis
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250605165953.jpg
---

先安装 Docker，并确认 `docker version` 能显示 Server 信息、`docker compose version` 有输出。Windows 的 Docker Desktop 需要使用 Linux 容器。

## 创建服务

在一个空目录保存 `compose.yaml`。下面使用 Redis 7.4 系列作本地练习，只允许本机连接，数据写入独立卷。

```yaml
services:
  redis:
    image: redis:7.4-alpine
    ports:
      - "127.0.0.1:16379:6379"
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis_data:
```

`16379` 是宿主机端口，`6379` 是容器端口。同一 Compose 网络里的其他服务用 `redis:6379`，宿主机程序用 `127.0.0.1:16379`。

## 启动与验证

在 `compose.yaml` 所在目录运行：

```bash
docker compose config
docker compose up -d
docker compose ps
docker compose exec redis redis-cli ping
docker compose exec redis redis-cli SET tutorial:greeting hello
docker compose exec redis redis-cli GET tutorial:greeting
```

`PING` 返回 `PONG`，`GET` 返回 `hello`。重启后再读一次，检查持久化：

```bash
docker compose restart redis
docker compose exec redis redis-cli GET tutorial:greeting
```

启动失败先看 `docker compose logs --tail=100 redis`。端口被占用时，修改映射左边的 `16379`；右边仍为 `6379`。

## 停止与数据保留

```bash
docker compose down
```

这会停止并删除容器，命名卷仍保留。`down -v` 会额外删除数据卷，不能把它当作普通重启命令。

本例没有配置远程访问或认证。需要给其他设备使用时，先设计认证、访问来源和网络限制，再修改监听范围。

参考：[Redis Docker 安装](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/docker/)、[Redis 持久化](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)。
