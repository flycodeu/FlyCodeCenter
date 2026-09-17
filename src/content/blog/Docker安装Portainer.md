---
title: Docker安装Portainer
createTime: '2026/03/01 19:23:46'
code: bcn24kspv
permalink: /blog/bcn24kspv/
tags:
  - Docker
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250606090911.jpg
---

> 官网：https://www.portainer.io/
Portainer 提供容器管理界面。以下示例管理本机 Docker，数据保存在独立卷中。安装参数见 [Portainer CE 官方文档](https://docs.portainer.io/start/install-ce/server/docker/linux)。
## 基础安装

### 1. 拉取 Portainer CE LTS
```bash
docker pull portainer/portainer-ce:lts
```

### 2.Docker运行Portainer
```bash
docker volume create portainer_data
docker run -d --restart=always --name portainer \
  -p 127.0.0.1:9443:9443 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data portainer/portainer-ce:lts
```

### 3. 访问Portainer
`https://localhost:9443`。远程访问可使用 SSH 隧道。默认使用自签名证书；首次初始化按当前版本的页面提示设置管理员，若要求 setup token，按官方初始化说明获取。下图为旧版本界面，布局可能不同。

![image-20250605133049002](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250605133049002.png)

可以在当前界面看到运行的docker程序

![image-20250605133309668](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250605133309668.png)
