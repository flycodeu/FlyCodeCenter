---
title: Docker安装PgVector
createTime: '2026/03/01 19:23:46'
code: b1bhicslx
permalink: /blog/b1bhicslx/
tags:
  - Docker
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250605165958.jpg
---

## 安装步骤

### 编写脚本

```bash
vim docker-compose-pgvector.yml
```

```yml
version: '3'
services:
  vector_db:
    image: registry.cn-hangzhou.aliyuncs.com/xfg-studio/pgvector:v0.5.0
    container_name: pgvector
    restart: always
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=springai
      - PGPASSWORD=postgres
    volumes:
      - ./pgdata:/var/lib/postgresql/data
      - ./pgvector/sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    logging:
      options:
        max-size: 10m
        max-file: "3"
    ports:
      - '5432:5432'
    healthcheck:
      test: "pg_isready -U postgres -d springai"
      interval: 2s
      timeout: 20s
      retries: 10
    networks:
      - my-network
networks:
  my-network:
    driver: bridge
```
### 运行脚本
```bash
docker-compose -f docker-compose-pgvector.yml up -d
```

### 启动PgVector

```bash
docker compose -f docker-compose-pgvector.yml start vector_db
```

### 查看运行状态

![image-20250605165523607](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250605165523607.png)

## 连接WSL的PgVector

### 开放远程登录

保存的数据在当前compose文件的同级 pgdata里面，我们需要进入修改如下两个配置。

![image-20250610084336393](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250610084336393.png)

1. 配置PostgreSQL服务监听地址。以容器内 `SHOW listen_addresses;` 的实际值为准，Docker 镜像可能已经监听所有地址

```shell
vim postgresql.conf
# 添加下面配置行
listen_addresses = '*'
```

2. 配置登录方式。默认只允许本地登录

```bash
vim pg_hba.conf
# 添加下面配置行
host    all             all             0.0.0.0/0               scram-sha-256
```

### 查看当前服务器IP

```bash
hostname -I
```

`hostname -I` 可能返回多个地址，顺序不能用来判断哪个可达。Windows 访问 WSL 服务优先核实 localhost 转发或当前网络模式，远程设备则需检查端口转发及防火墙。

### 添加Windows入站规则

新建如下规则

![image-20250610093051870](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250610093051870.png)

### 软件连接

使用数据库客户端连接时，分别检查连接成功、目标数据库存在和扩展安装状态。某个客户端的单次报错不能说明其他客户端都不可用。

![image-20250610091712413](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250610091712413.png)

## 安装扩展
### 1. 创建数据库
```bash
docker exec -it pgvector psql -U postgres -d ai-rag-knowledge
```
确保数据库 ai-rag-knowledge 已存在。如果没有，可以手动创建：
```bash
docker exec -it pgvector psql -U postgres -c "CREATE DATABASE \"ai-rag-knowledge\";"
```
### 2. 安装 pgvector 插件（在该数据库里）
连接成功后，执行：
```bash
CREATE EXTENSION IF NOT EXISTS vector;
```
成功会输出：

```bash
CREATE EXTENSION
```
### 3. 创建 vector_store 表（带有 vector 类型字段）
执行下面的 SQL（建议手动先创建）：
```bash
CREATE TABLE IF NOT EXISTS vector_store (
id TEXT PRIMARY KEY,
content TEXT,
metadata JSONB,
embedding VECTOR(1536)  -- 1536 仅为示例，必须与所选模型的实际输出维度一致
);
```

如果建表失败，先根据错误检查扩展、权限和现有表结构。已有数据的表应通过迁移调整；`IF NOT EXISTS` 不会修改旧表，也不应通过删表来处理普通配置错误。

### 4.验证是否成功
执行：
```bash
\d+ vector_store
```
你应当看到类似输出：
```
ai-rag-knowledge=# \d+ vector_store
                                           Table "public.vector_store"
  Column   |     Type     | Collation | Nullable | Default | Storage  | Compression | Stats target | Description
-----------+--------------+-----------+----------+---------+----------+-------------+--------------+-------------
 id        | text         |           | not null |         | extended |             |              |
 content   | text         |           |          |         | extended |             |              |
 metadata  | jsonb        |           |          |         | extended |             |              |
 embedding | vector(1536) |           |          |         | extended |             |              |
Indexes:
    "vector_store_pkey" PRIMARY KEY, btree (id)
Access method: heap
```
