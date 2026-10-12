---
title: Linux常用运维脚本
createTime: '2026/03/01 19:23:46'
code: blitcvgyg
permalink: /blog/blitcvgyg/
tags:
  - Linux
---

下面是 Bash 中常用的检查、备份和日志维护命令。安装示例适用于使用 APT 的 Debian / Ubuntu；先确认系统版本和软件包，再执行安装。

## 查看资源占用

```bash
df -h
free -h
top
```

- `df -h` 查看文件系统容量。
- `free -h` 查看内存使用情况。
- `top` 查看进程，按 `q` 退出。

查找指定目录下超过 100 MiB 的文件：

```bash
find /var/log -type f -size +100M -exec ls -lh -- {} +
```

把 `/var/log` 换成需要检查的目录。此命令只列出文件，不清理文件。

## 检查和安装软件包

先检查发行版和软件源中的候选版本：

```bash
cat /etc/os-release
apt-cache policy nginx
```

确认后安装 Nginx：

```bash
sudo apt-get update
sudo apt-get install nginx
sudo systemctl enable --now nginx
systemctl status nginx --no-pager
```

`enable --now` 同时设置开机启动并立即启动服务。Docker、Node.js、MongoDB 等软件的仓库配置随发行版变化，应使用各项目的安装文档，不复用旧版的 `apt-key` 脚本。

## 备份 MySQL

使用 `mysql_config_editor` 保存一个名为 `backup` 的连接配置；密码由命令交互读取：

```bash
mysql_config_editor set --login-path=backup --host=127.0.0.1 --user=backup_user --password
```

将下方脚本保存为 `backup-mysql.sh`，把库名和目录改为自己的值：

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077

db_name="your_database"
backup_dir="$HOME/db-backups"
mkdir -p -- "$backup_dir"
backup_file="$backup_dir/$db_name-$(date +%Y%m%d-%H%M%S).sql"

mysqldump --login-path=backup --single-transaction --databases "$db_name" > "$backup_file"
printf '备份完成：%s\n' "$backup_file"
```

`--single-transaction` 适合 InnoDB 一致性备份；备份期间避免修改表结构。非事务表不能靠该选项保证一致性。备份账号还需要相应权限，备份成功后应在独立测试库验证恢复。[MySQL 备份说明](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html)

## 压缩指定目录

```bash
source_dir="/path/to/data"
archive_file="$HOME/data-backup.tar.gz"
tar -czf "$archive_file" -C "$(dirname -- "$source_dir")" -- "$(basename -- "$source_dir")"
tar -tzf "$archive_file" | head
```

输出文件放在源目录之外。第二条命令列出归档内容，先确认需要的文件已写入。

## 查看与维护日志

对于 systemd journal：

```bash
journalctl --disk-usage
journalctl -u nginx --since today --no-pager
```

需要清理已归档的 journal 时，先确定保留期限。例如保留最近 14 天：

```bash
sudo journalctl --rotate --vacuum-time=14d
```

这会删除超出期限的归档日志。普通文本日志交给 [logrotate](https://github.com/logrotate/logrotate) 轮转，不要批量截空正在写入的 `/var/log/*.log`。[journalctl 手册](https://www.freedesktop.org/software/systemd/man/latest/journalctl.html)

## 创建 Python 虚拟环境

```bash
sudo apt-get install python3 python3-venv
python3 -m venv .venv
source .venv/bin/activate
python --version
deactivate
```

进入虚拟环境后再安装项目依赖。Python 的实际版本由当前发行版的软件源决定。
