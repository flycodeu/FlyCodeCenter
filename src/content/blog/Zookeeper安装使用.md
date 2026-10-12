---
title: Zookeeper安装使用
createTime: '2026/03/01 19:23:46'
code: borpq037w
permalink: /blog/borpq037w/
tags:
  - Zookeeper
---

ZooKeeper 用于维护分布式系统的协调数据。先用单节点学习创建、读取和删除节点；单节点不能提供集群容错。

## 创建本地服务

安装并启动 Docker，保存 `compose.yaml`：

```yaml
services:
  zookeeper:
    image: zookeeper:3.9
    ports:
      - "127.0.0.1:2181:2181"
    volumes:
      - zk_data:/data
      - zk_datalog:/datalog

volumes:
  zk_data:
  zk_datalog:
```

官方镜像包含运行环境，宿主机不需要再安装 Java。不要复制别人的容器 ID 或镜像 ID。

```bash
docker compose up -d
docker compose ps
docker compose logs --tail=100 zookeeper
docker compose exec zookeeper zkCli.sh -server 127.0.0.1:2181
```

## 操作节点

进入 `zkCli.sh` 后执行：

```text
ls /
create /tutorial hello
get /tutorial
set /tutorial world
get /tutorial
delete /tutorial
quit
```

第一次 `get` 得到 `hello`，修改后得到 `world`。节点名已经存在时 `create` 会报错，先 `get` 确认状态。`delete` 删除示例节点；有子节点的节点不能直接按这条命令删除。

## 数据与运行方式

命名卷保存快照和事务日志，`docker compose down` 停止服务但保留卷。多个服务构成集群时，还需要独立服务器标识、成员配置与节点间端口，不能仅复制本地端口映射。

从压缩包安装时应选择 `apache-zookeeper-版本-bin.tar.gz` 二进制发行包，复制 `zoo_sample.cfg` 为 `zoo.cfg`，配置持久化数据目录，再用 `zkServer.sh` 启动。源码压缩包不能当作二进制发行包直接启动。

参考：[ZooKeeper 入门](https://zookeeper.apache.org/doc/r3.9.4/zookeeperStarted.html)、[Docker 官方镜像](https://hub.docker.com/_/zookeeper)。
