---
title: Ubuntu 安装 Redis 与本机连接
createTime: '2026/03/01 19:23:46'
code: b1gypqcdg
permalink: /blog/b1gypqcdg/
tags:
  - Ubuntu
  - Redis
---

下面使用 Ubuntu 软件仓库提供的 Redis，适合本机开发练习。Docker 环境可直接阅读 [Redis Compose 安装](/blog/b5v3zffdg/)。

## 安装与验证

在 Ubuntu Bash 中执行：

```bash
sudo apt-get update
sudo apt-get install -y redis-server redis-tools
sudo systemctl enable --now redis-server
redis-server --version
redis-cli -h 127.0.0.1 -p 6379 ping
```

返回 `PONG` 表示客户端已连接。发行版仓库提供的版本以实际输出为准，不一定等于 Redis 上游的最新版本。

## 一次带过期时间的读写

```bash
redis-cli SET tutorial:greeting hello EX 60
redis-cli GET tutorial:greeting
redis-cli TTL tutorial:greeting
```

键保存 60 秒，GET 应先得到 `hello`，过期后为空。这里只操作 `tutorial:greeting`，不要为练习运行 FLUSHALL 清空已有数据。

运行状态和日志：

```bash
sudo systemctl status redis-server --no-pager
sudo journalctl -u redis-server -n 100 --no-pager
```

远程连接需要另行配置认证、允许访问的来源和网络边界；本地教程不要求监听全部 IP。

参考：[Redis 安装](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/)、[SET 命令](https://redis.io/docs/latest/commands/set/)。
