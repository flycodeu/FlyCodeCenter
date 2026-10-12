---
title: 自定义Docker镜像
createTime: '2026/03/01 19:23:46'
code: bbnmvqhup
permalink: /blog/bbnmvqhup/
tags:
  - Docker
cover: 'https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/bg06.jpg'
---

下面把一个已打包的 Spring Boot JAR 放进镜像，再推送到自己的镜像仓库。构建、运行和推送统一使用 `demo-app:1.0`，避免镜像名混用。

## 准备 JAR 与 Dockerfile

先在自己的项目运行 `mvn clean package`，确认产物是能够用 `java -jar` 启动的 JAR。将它复制为 `app.jar`，与下面的 `Dockerfile` 放在同一目录。本例使用 Java 17，项目使用更高版本 Java 时同步调整基础镜像。

```dockerfile
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY app.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

`COPY` 只复制文件；`EXPOSE` 说明容器服务端口，不会自动发布宿主机端口。旧 `openjdk:17-jdk-slim` 镜像系列已弃用。

```bash
docker build -t demo-app:1.0 .
docker run --rm --name demo-app -p 127.0.0.1:8080:8080 -e SERVER_PORT=8080 demo-app:1.0
```

保持终端运行，在浏览器访问项目实际提供的接口。退出时按 Ctrl+C。需要 JVM 参数可传 `JAVA_TOOL_OPTIONS`，例如 `-Xmx512m`；不要把 JVM 参数写到 `java -jar` 与 JAR 路径之间。

## 推送到自己的仓库

先在仓库控制台创建命名空间和镜像仓库。下面是 Bash，替换仓库域名与路径；`REGISTRY` 只含域名，`REMOTE_IMAGE` 才包含命名空间和镜像名。

```bash
REGISTRY='your-registry.example.com'
REMOTE_IMAGE="$REGISTRY/your-namespace/demo-app:1.0"
read -r -p '仓库用户名: ' REGISTRY_USER
read -r -s -p '仓库密码或令牌: ' REGISTRY_PASSWORD
printf '\n'
printf '%s' "$REGISTRY_PASSWORD" | docker login "$REGISTRY" --username "$REGISTRY_USER" --password-stdin
unset REGISTRY_PASSWORD
docker tag demo-app:1.0 "$REMOTE_IMAGE"
docker push "$REMOTE_IMAGE"
```

登录只用于仓库认证；推送前本地必须已经存在 `demo-app:1.0`。换一台机器拉取同一个远程镜像，可复用同一 JAR 和运行环境。部署配置、数据库地址和密钥在运行时传入，不打进镜像。

参考：[Docker Java 镜像](https://docs.docker.com/guides/java/)、[docker login](https://docs.docker.com/reference/cli/docker/login/)、[OpenJDK 镜像弃用说明](https://github.com/docker-library/openjdk)。
