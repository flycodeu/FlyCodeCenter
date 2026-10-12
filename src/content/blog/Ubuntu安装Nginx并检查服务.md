---
title: Ubuntu 安装 Nginx 并检查服务
createTime: '2026/03/01 19:23:46'
code: b1zpz9r49
permalink: /blog/b1zpz9r49/
tags:
  - Ubuntu
  - Nginx
---

下面在 Ubuntu 的 Bash 中安装软件仓库提供的 Nginx。需要 sudo 权限，先确认当前服务器的 80 端口没有被其他服务占用。

```bash
sudo apt-get update
sudo apt-get install -y nginx
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl status nginx --no-pager
curl -I http://127.0.0.1/
```

`nginx -t` 检查配置；systemd 状态显示进程是否运行；HTTP 响应验证本机请求是否到达服务。三者不是同一个检查。

## 修改配置后

Ubuntu 软件包通常把主配置放在 `/etc/nginx/nginx.conf`，站点配置放在 `/etc/nginx/sites-available/`，通过 sites-enabled 启用。先查看实际 include 关系：

```bash
sudo nginx -T
```

输出可能包含自己的站点信息，不要直接公开完整配置。修改站点后先执行 `sudo nginx -t`，通过后再执行 `sudo systemctl reload nginx`。

远程无法访问时，按“本机 HTTP、监听地址、系统防火墙、云安全组”顺序检查，而不是一开始就关闭防火墙。HTTPS、反向代理和静态网页部署按具体站点配置。

参考：[Nginx 初学者指南](https://nginx.org/en/docs/beginners_guide.html)。
