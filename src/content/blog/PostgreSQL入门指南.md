---
title: PostgreSQL 入门指南
createTime: '2026/11/23 14:44:20'
code: bug1e6dth
permalink: /blog/bug1e6dth/
tags:
  - PostgreSQL
  - SQL
---

一家文具店想知道哪些商品快卖完了。把商品名称和库存数量存进 PostgreSQL，就可以用一句 SQL 找出库存少于 10 件的商品。我们从安装开始，把这张库存表做出来。

[下载 Word 版](/downloads/postgresql-guide.docx)

## 先认识数据库和表

PostgreSQL（常简称为 PG 或 PgSQL）是一种关系型数据库软件。它用表来保存数据。下面是一张库存表，每一行代表一种商品，每一列记录一种信息。

| 商品编号 | 商品名称 | 库存数量 |
| --- | --- | --- |
| 1 | 铅笔 | 12 |
| 2 | 笔记本 | 5 |
| 3 | 橡皮 | 8 |

如果用过 Excel，可以先把这张表想成一张工作表。查询时，用 SQL 告诉数据库要看哪些列、要找哪些行。比如，要做补货清单，只需要看“商品名称”和“库存数量”，再筛出库存少于 10 的行。

练习会用到三个名字。**PostgreSQL** 负责保存数据。**psql** 是输入命令的工具。**pgAdmin** 是带窗口和按钮的管理工具。psql 和 pgAdmin 可以连接到同一个库，看到同一批商品。

## 安装并第一次连接

按自己的操作系统选一种做法。完成后，在同一个窗口运行本节末尾的查询，确认连接成功。

### Windows

1. 打开 PostgreSQL 的 Windows 下载页，点 **Download the installer**，下载适合本机的正式版安装程序。[Windows 官方下载页](https://www.postgresql.org/download/windows/)
2. 运行安装程序，保留 **PostgreSQL Server** 和 **Command Line Tools**。想用图形界面，就按提示安装 **pgAdmin 4**。额外工具 **Stack Builder** 可以跳过。
3. 给数据库管理员 `postgres` 设置密码并记好。端口用默认的 `5432`。如果安装时改了端口，后面连接时也要填相同的值。
4. 安装完成后，在开始菜单打开 **SQL Shell (psql)**。依次确认服务器 `localhost`（本机）、数据库 `postgres`、端口和用户名 `postgres`。方括号里的默认值正确时，按回车即可。最后输入刚设置的密码，再按回车。输入密码时屏幕不会显示字符。

### Ubuntu

打开终端，逐行运行下面三条命令。第一条刷新软件列表，第二条安装数据库，第三条以系统用户 `postgres` 的身份连接本机数据库。如果 `sudo` 提示输入密码，输入当前 Ubuntu 用户的密码。[Ubuntu 安装说明](https://ubuntu.com/server/docs/how-to/databases/install-postgresql/)

```bash
sudo apt update
sudo apt install postgresql
sudo -u postgres psql -d postgres
```

### macOS

下载 Postgres.app，把它拖进“应用程序”后打开。点击 **Initialize** 创建本地数据库，再双击与 Mac 用户同名的数据库，进入 psql。练习时保持 Postgres.app 运行。[Postgres.app 下载与说明](https://postgresapp.com/)

### 确认已经连上

在刚打开的 psql 窗口输入下面这行，保留末尾的英文分号，再按回车。

```sql
SELECT current_database(), current_user;
```

结果有两列，分别是当前数据库名和用户名。按上面的 Windows 或 Ubuntu 步骤操作，两列通常都是 `postgres`。按 macOS 步骤操作，两列通常是你的 Mac 用户名。

## 建立练习库和库存表

### 新建并进入练习库

在已连接的 psql 窗口执行下面这句，创建一个叫 `pg_practice` 的练习库。如果已经建过这个库，直接执行下一步。

```sql
CREATE DATABASE pg_practice;
```

单独输入下一行并按回车，切换到练习库。反斜杠开头的是 psql 自己的命令，结尾不用加分号。

```text
\c pg_practice
```

再执行 `SELECT current_database();`，看到 `pg_practice` 就可以建表了。以后重新打开 psql，也先用 `\c pg_practice` 回到这个库。

### 用 pgAdmin 打开练习库

喜欢用窗口操作的话，可以从这里换用 pgAdmin。打开 pgAdmin，展开左侧的 **Servers**，点本机的 PostgreSQL 服务器。Windows 用户输入安装时设置的数据库密码。电脑上还没有 pgAdmin 的话，可以先下载桌面版。[pgAdmin 官方下载页](https://www.pgadmin.org/download/)

如果 **Servers** 下是空的，右键它，选 **Register → Server**。在 **General** 页给连接起名，比如“本机”。到 **Connection** 页，主机填 `localhost`，端口填安装时的值（默认 `5432`），用户名填刚才查到的 `current_user`，然后保存。Ubuntu 用户如果需要设置数据库密码，可在刚才的 psql 窗口输入 `\password`，按提示设置，再用这个密码连接。[pgAdmin 连接设置](https://www.pgadmin.org/docs/pgadmin4/latest/server_dialog.html)

展开 **Databases**（数据库），右键 `pg_practice`，选 **Query Tool**（查询工具）。如果没看到新库，先右键 **Databases**，点 **Refresh**。把下方的 SQL 粘到编辑区，选中要运行的一条，按 **F5**。查询结果在 **Data Output** 里。继续用 psql 也可以，以下 SQL 在两个工具中写法相同。[pgAdmin 查询工具说明](https://www.pgadmin.org/docs/pgadmin4/latest/query_tool.html)

### 建表并录入三种文具

表名用 `products`。三列分别叫 `id`（商品编号）、`name`（商品名称）和 `stock`（库存数量）。

```sql
CREATE TABLE products (
    id integer PRIMARY KEY,
    name text NOT NULL,
    stock integer NOT NULL
);
```

`integer` 表示整数，`text` 表示文字。`PRIMARY KEY` 把商品编号设为主键，每个编号只能出现一次。`NOT NULL` 要求这一列必须有值。

```sql
INSERT INTO products (id, name, stock)
VALUES (1, '铅笔', 12),
       (2, '笔记本', 5),
       (3, '橡皮', 8);
```

每对括号里是一种商品，三个值的顺序与第一行的列名一致。文字两边用英文单引号。建表和这次录入只做一次，之后可以反复查询。

## 查询和修改库存

### 哪些文具需要补货

```sql
SELECT name, stock
FROM products
WHERE stock < 10
ORDER BY stock;
```

逐行读就是“显示名称和库存，从商品表里找，只留库存少于 10 的商品，按库存从少到多排”。结果如下。

| name（名称） | stock（库存） |
| --- | --- |
| 笔记本 | 5 |
| 橡皮 | 8 |

### 把笔记本的库存改为 7

盘点时发现笔记本实际有 7 本。先用编号确认是哪种商品。

```sql
SELECT id, name, stock FROM products WHERE id = 2;
```

看到“2、笔记本、5”后，执行下面的修改。再运行刚才的查询，这次库存应当是 7。`WHERE id = 2` 指定修改哪一行。省略这个条件会把整张表的库存都改成 7。

```sql
UPDATE products SET stock = 7 WHERE id = 2;
```

### 一共有几种商品和多少件库存

```sql
SELECT COUNT(*) AS kinds, SUM(stock) AS total_stock
FROM products;
```

`COUNT(*)` 数行数，每种商品占一行，所以是 **3 种**。`SUM(stock)` 把库存相加，12 + 7 + 8 等于 **27 件**。`AS` 给结果列起名，方便认出两个数字。

## 删除一行并练习撤销

假设橡皮准备下架，先试着删掉它，再把它恢复。在同一个查询窗口逐条执行下面的命令。

```sql
BEGIN;
DELETE FROM products WHERE id = 3;
SELECT COUNT(*) FROM products;
```

此时能查到 **2** 种商品。`BEGIN` 开启了一次事务，也就是让一组操作可以一起确认或撤销。现在执行撤销。

```sql
ROLLBACK;
SELECT COUNT(*) FROM products;
```

行数回到 **3**，橡皮也回来了。如果确实要保存这次删除，应当在事务结束时执行 `COMMIT;`。已经提交的删除无法再用 `ROLLBACK` 撤销。[PostgreSQL 事务教程](https://www.postgresql.org/docs/current/tutorial-transactions.html)

### 自己试一次

沿用刚才的 3 种商品。店里新到 6 把直尺，编号是 4。试着录入它，再找出库存**不超过 8 件**的商品。写完后，用下面的答案核对。

```sql
INSERT INTO products (id, name, stock) VALUES (4, '直尺', 6);

SELECT name, stock FROM products
WHERE stock <= 8
ORDER BY stock;
```

结果依次是直尺 6、笔记本 7、橡皮 8。`<=` 包含 8，所以橡皮也在清单里。再运行上一节的汇总查询，会得到 **4 种、33 件**。

## 备份并恢复到新库

下面用桌面版 pgAdmin 把库存表连同数据备份成文件，再恢复到另一个库。如果做完了直尺练习，恢复后应当仍是 4 种商品、共 33 件。

1. 在 pgAdmin 中右键 `pg_practice`，选 **Backup**（备份）。在 **Filename** 旁点浏览按钮，选一个找得到的文件夹，文件名填 `pg_practice.backup`。**Format** 选 **Custom**，再点 **Backup**。
2. 打开 **Processes**（任务），等备份状态显示 **Finished**。然后右键左侧 **Databases**，选 **Create → Database**，建立一个名为 `pg_practice_copy` 的空库。
3. 右键新库 `pg_practice_copy`，选 **Restore**（恢复）。格式选 **Custom or tar**，选中刚才的备份文件，再点 **Restore**。等恢复任务也显示 **Finished**。
4. 从 `pg_practice_copy` 打开 **Query Tool**，依次执行下面两句。第一句应返回 `pg_practice_copy`，第二句应与备份前的商品种数和库存总数一致。

```sql
SELECT current_database();
SELECT COUNT(*) AS kinds, SUM(stock) AS total_stock FROM products;
```

若任务显示 **Failed**，点 **More details** 查看失败的原因。[pgAdmin 备份说明](https://www.pgadmin.org/docs/pgadmin4/latest/backup_dialog.html) · [恢复说明](https://www.pgadmin.org/docs/pgadmin4/latest/restore_dialog.html)

## 遇到这些提示时怎么处理

| 看到的现象 | 可以怎么做 |
| --- | --- |
| 输完 SQL 后只换行，没有结果 | 看末尾是否少了英文分号。如果 psql 正在等下一行，输入 `;` 再回车。 |
| 连接时提示 `connection refused` | 核对主机和端口。在 Windows 的“服务”中启动 PostgreSQL。Ubuntu 可在终端运行 `sudo systemctl start postgresql`，macOS 则打开 Postgres.app。 |
| 提示 `password authentication failed` | 核对数据库用户名和密码。Windows 安装时设置的是数据库用户 `postgres` 的密码。 |
| 查表时提示 `relation "products" does not exist` | 用 `SELECT current_database();` 看当前库名，切回 `pg_practice`。如果从未建过表，先运行建表语句。 |
| 录入时提示 `duplicate key` | 这个编号已经存在。用 `SELECT * FROM products WHERE id = 4;` 检查编号 4，查其他编号时换掉数字。 |

退出 psql 用 `\q`，再按回车。下次连接到同一个库，已经提交的数据还在。[psql 命令说明](https://www.postgresql.org/docs/current/app-psql.html)

## PostgreSQL 和 MySQL、SQLite 怎么选

三者都能完成这次库存练习里的查询、筛选和统计。选给实际项目用时，先看数据存在哪里、谁来读写，以及团队已经在用什么。

| 数据库 | 数据怎么用 | 什么时候选 |
| --- | --- | --- |
| PostgreSQL | 单独运行数据库服务，多台电脑可以连接同一个库。 | 多家门店共用一份库存，还需要按距离查附近的仓库。PostgreSQL 可以加装 PostGIS 做距离查询。 |
| MySQL | 同样运行数据库服务，也能让多人读写同一份数据。 | 已有订单系统、备份工具和维护人员都在用 MySQL，新库存模块可以沿用这套工具。 |
| SQLite | 应用直接读写本机数据库文件，省去安装数据库服务的步骤。 | 做个人记账本或离线盘点工具，数据留在一台设备上。同一个数据库文件同一时刻只允许一个写入者。 |

三者的入门查询很相似，但建库和切换数据库的操作有差别。例如，MySQL 用 `USE 库名;`，PostgreSQL 的 psql 用 `\c 库名`。学会按条件查数据，这部分经验可以带到其他数据库。[PostgreSQL 简介](https://www.postgresql.org/about/) · [PostGIS 距离查询](https://postgis.net/docs/ST_DWithin.html) · [MySQL 简介](https://dev.mysql.com/doc/refman/8.4/en/what-is-mysql.html) · [SQLite 适用场景](https://www.sqlite.org/whentouse.html)

### 接下来学什么

先试着不看示例写出“库存最少的两种商品”。在按库存升序排列的查询末尾、分号前加上 `LIMIT 2`。做完直尺练习后，答案是直尺和笔记本。

接着试试一张表回答不了的问题，比如“每种文具是谁供应的”。给供应商单独建表，在商品表里记下供应商编号，再学习用 `JOIN` 把两张表中编号相同的记录连起来。[PostgreSQL 官方入门教程](https://www.postgresql.org/docs/current/tutorial.html) · [两张表的关联查询](https://www.postgresql.org/docs/current/tutorial-join.html)
