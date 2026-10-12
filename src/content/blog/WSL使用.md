---
title: WSL使用
createTime: '2026/03/01 19:23:46'
code: b1pax2jcd
permalink: /blog/b1pax2jcd/
tags:
  - WSL
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250606090922.jpg
---

WSL 让 Windows 运行 Linux 环境。下面使用 Ubuntu，PowerShell 命令在 Windows 执行，Linux 命令在 Ubuntu 终端执行。

## 安装与进入 Ubuntu

以管理员身份打开 PowerShell：

```powershell
wsl --install -d Ubuntu
```

按安装提示重启，首次启动 Ubuntu 时创建 Linux 用户和密码。输入 Linux 密码时终端不会显示字符。

在 PowerShell 检查并进入环境：

```powershell
wsl --list --verbose
wsl --status
wsl -d Ubuntu
```

列出的发行版名称以本机输出为准，例如 `Ubuntu-24.04`，后续命令需要使用相同名称。要使用 WSL 2，可运行 `wsl --set-version Ubuntu 2`，并确认系统开启虚拟化。

进入 Linux 后检查：

```bash
cat /etc/os-release
pwd
uname -m
```

Windows 的 D 盘通常挂载在 `/mnt/d`。Linux 项目也可放在自己的主目录，避免混用 Windows 与 Linux 的依赖目录。输入 `exit` 返回 PowerShell。

## 更新、停止和备份

下面仍在 PowerShell 执行：

```powershell
wsl --update
wsl --set-default Ubuntu
wsl --terminate Ubuntu
New-Item -ItemType Directory -Path 'D:\WSLBackups' -Force | Out-Null
wsl --export Ubuntu 'D:\WSLBackups\ubuntu.tar'
```

`--terminate` 停止该发行版内的所有进程，应先保存工作。导出前停止服务可降低数据不一致风险；数据库仍应使用自身的备份工具。

导入为一个新的发行版，保留原环境：

```powershell
wsl --import Ubuntu-Restore 'D:\WSL\Ubuntu-Restore' 'D:\WSLBackups\ubuntu.tar' --version 2
wsl -d Ubuntu-Restore
```

`wsl --unregister 发行版名` 会删除该发行版及其数据，不能当作退出或重启命令。

## 服务和网络

新版 WSL 支持 systemd，但是否启用要检查当前发行版。按 [微软 systemd 配置说明](https://learn.microsoft.com/en-us/windows/wsl/systemd) 操作；不要将“WSL 不支持 systemd”当成通用结论。

Windows 访问 Linux 服务时先试 `localhost:端口`。是否需要 WSL IP、端口代理或防火墙配置，取决于 NAT/镜像网络、服务监听地址和访问来源。

参考：[安装 WSL](https://learn.microsoft.com/en-us/windows/wsl/install)、[WSL 网络](https://learn.microsoft.com/en-us/windows/wsl/networking)。
