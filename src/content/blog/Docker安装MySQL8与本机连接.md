---
title: Docker 安装 MySQL 8 与本机连接
createTime: '2026/03/01 19:23:46'
code: bd5g8h9tf
permalink: /blog/bd5g8h9tf/
tags:
  - Docker
  - MySQL
---

下面使用 MySQL 8.4 官方容器，在空目录中建立本地练习环境。先确认 Docker 和 Compose 已运行，数据保存在命名卷中。

创建 `.env`，填写自己的本地管理员密码，并把该文件加入 .gitignore：

```dotenv
MYSQL_ROOT_PASSWORD=replace-with-your-local-password
```

保存 `compose.yaml`：

```yaml
services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?请在.env中设置MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: tutorial_db
    ports:
      - "127.0.0.1:3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

## 启动与连接

```bash
docker compose up -d
docker compose logs --tail=100 mysql
docker compose exec mysql mysql -uroot -p tutorial_db
```

第一次初始化需要时间。出现可接收连接的日志后执行客户端命令，按提示输入 .env 中的密码。在 MySQL 客户端里运行：

```sql
SELECT VERSION(), DATABASE();
CREATE TABLE IF NOT EXISTS greeting (id INT PRIMARY KEY, text VARCHAR(100) NOT NULL);
INSERT INTO greeting VALUES (1, 'hello') ON DUPLICATE KEY UPDATE text = 'hello';
SELECT * FROM greeting;
```

执行 `exit` 退出客户端。容器内连接使用 3306，宿主机映射端口是 3307。通过宿主机程序连接还需创建允许该来源访问的业务账号，并只授予所需库权限；不要以开放 root 远程登录作为通用方案。

修改 `.env` 不会重设已有数据卷中的账号密码。`docker compose down` 保留卷，`down -v` 会删除卷，不能用删除数据来处理普通连接错误。

参考：[MySQL 官方镜像](https://hub.docker.com/_/mysql)、[MySQL 连接与权限](https://dev.mysql.com/doc/refman/8.4/en/connecting.html)。
