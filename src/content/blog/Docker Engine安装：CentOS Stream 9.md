---
title: Docker Engine 安装：CentOS Stream 9
createTime: '2026/03/01 19:23:46'
code: b4zgqt4b1
permalink: /blog/b4zgqt4b1/
tags:
  - Docker
  - Linux
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250606090917.jpg
---

CentOS Linux 7 已停止维护，新安装不要继续套用旧 Yum 源。下面针对 CentOS Stream 9；先用 `cat /etc/os-release` 确认发行版，用 `uname -m` 看 CPU 架构，`uname -r` 只显示内核版本。

## 安装 Engine 与 Compose 插件

在 Linux Bash 中执行，需要 sudo 权限：

```bash
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

安装前已有 Docker、Podman 或其他容器运行时的机器，应先按官方说明核对冲突包和已有数据，不直接清空 `/var/lib/docker`。

## 验证

```bash
sudo docker version
sudo docker compose version
sudo docker run --rm hello-world
```

Engine 和 Compose 都有版本输出，测试容器打印欢迎信息后退出，才说明基本链路可用。镜像拉取失败时检查 DNS、代理和仓库访问；不要把随机“镜像加速地址”写入配置并覆盖已有 daemon.json。

Linux 安装的是 `docker compose` 插件，不需要另外下载旧的 `docker-compose` 独立二进制。Windows 使用 Docker Desktop 时采用它自带的 Compose，并按 [WSL 入门](/blog/b1pax2jcd/) 配置 Linux 环境。

## 查看与停止

```bash
sudo docker ps
sudo docker ps -a
sudo journalctl -u docker -n 100 --no-pager
```

容器示例见 [Redis 安装](/blog/b5v3zffdg/)。后续命令未加 sudo 时，需要当前用户有权访问 Docker；docker 组权限接近管理员权限，是否加入由机器管理规则决定。

参考：[Docker CentOS 安装说明](https://docs.docker.com/engine/install/centos/)。
