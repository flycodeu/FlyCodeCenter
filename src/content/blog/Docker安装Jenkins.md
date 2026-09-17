---
title: Docker安装Jenkins
createTime: '2026/03/01 19:23:46'
code: b2fwa14jz
permalink: /blog/b2fwa14jz/
tags:
  - Docker
  - Jenkins
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250605170107.jpg
---

Jenkins 官方容器镜像已经包含运行 Jenkins 所需的 Java。宿主机不必为控制器额外安装 Java 8；构建 Java 8 项目所用的 JDK 应在构建工具或 Agent 中另行配置。

## 启动控制器

下面沿用宿主机端口 `9090`，使用官方文档中的 `lts-jdk21` 镜像系列。正式部署时应记录实际镜像版本或摘要，便于回滚。参见 [Jenkins Docker 安装文档](https://www.jenkins.io/doc/book/installing/docker/)。

保存为 `compose.yaml`：

```yaml
services:
  jenkins:
    image: jenkins/jenkins:lts-jdk21
    restart: unless-stopped
    ports:
      - "127.0.0.1:9090:8080"
    volumes:
      - jenkins_home:/var/jenkins_home

volumes:
  jenkins_home:
```

```bash
docker compose up -d
docker compose logs --tail=100 jenkins
docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

在本机访问 `http://localhost:9090`，按安装向导创建管理员。远程服务器可通过 SSH 隧道访问这个仅绑定回环地址的端口，或配置带 HTTPS 和访问控制的反向代理。

## 构建工具放在哪里

| 需求 | 配置位置 |
| --- | --- |
| Jenkins 自身运行的 Java | Jenkins 镜像 |
| 项目编译所需 JDK、Maven | Agent 镜像或 Jenkins 工具配置 |
| Maven `settings.xml` | 已安装 Maven 的环境，或通过 `mvn -s` 指定 |
| 持久化任务、插件和配置 | `jenkins_home` 卷 |

只挂载一个 JDK 目录不会自动改变 Jenkins 的启动 Java；只挂载 `settings.xml` 也不会安装 Maven。需要构建 Docker 镜像时，再单独设计 Agent 和 Docker daemon 的连接方式，不要为了启动控制器直接启用 `privileged` 或把宿主机 Docker socket 暴露给所有任务。
