---
title: Docker安装PgVector
createTime: '2026/03/01 19:23:46'
code: b1bhicslx
permalink: /blog/b1bhicslx/
tags:
  - Docker
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250605165958.jpg
---

pgvector 是 PostgreSQL 的扩展。安装含扩展文件的镜像后，还要在目标数据库执行 `CREATE EXTENSION vector`，才能使用 `vector` 类型。

## 启动 PostgreSQL

先确认 Docker 与 Compose 可用。在空目录创建 `.env`，设置本地练习密码：

```dotenv
POSTGRES_PASSWORD=replace-with-your-local-password
```

把 `.env` 加入 `.gitignore`。再保存 `compose.yaml`：

```yaml
services:
  vector_db:
    image: pgvector/pgvector:0.8.7-pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?请在.env中设置POSTGRES_PASSWORD}
      POSTGRES_DB: springai
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d springai"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

```bash
docker compose up -d
docker compose ps
docker compose exec vector_db psql -U postgres -d springai
```

进入 `psql` 后，下面是 SQL，不是终端命令。所有步骤都使用同一个数据库 `springai`。

## 验证向量查询

```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extversion FROM pg_extension WHERE extname = 'vector';

CREATE TABLE IF NOT EXISTS tutorial_items (
    id bigserial PRIMARY KEY,
    embedding vector(3) NOT NULL
);
INSERT INTO tutorial_items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]');
SELECT id, embedding, embedding <-> '[3,1,2]' AS distance
FROM tutorial_items
ORDER BY embedding <-> '[3,1,2]'
LIMIT 5;
```

`<->` 计算欧氏距离，距离越小越接近。这里的三维向量只用于理解查询；接入嵌入模型时，列维度必须与模型输出一致。重复执行 INSERT 会添加新行。

在 `psql` 中执行 `\q` 退出。宿主机数据库客户端填写 `127.0.0.1:5432`、数据库 `springai`、用户名 `postgres` 和 `.env` 中设置的密码。

## 常见问题

- 连接拒绝：看 `docker compose ps` 和 `docker compose logs --tail=100 vector_db`，检查宿主机 5432 是否已被占用。
- 修改 `.env` 后密码没变：`POSTGRES_*` 初始化变量只对空数据目录生效，已有数据库需要通过 SQL 修改角色密码。
- 提示没有 vector 类型：确认连接的是 `springai`，并在这个数据库启用扩展。
- 表已存在但维度不对：`IF NOT EXISTS` 不会修改旧表，需要评估数据迁移。

Windows 使用 Docker Desktop 时先尝试 localhost，不必先开放 Windows 防火墙或把 `pg_hba.conf` 改成允许全部来源。

参考：[pgvector 安装与查询](https://github.com/pgvector/pgvector)、[PostgreSQL 官方镜像初始化说明](https://hub.docker.com/_/postgres)。
