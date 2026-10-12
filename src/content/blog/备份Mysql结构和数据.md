---
title: 备份Mysql结构和数据
createTime: '2026/03/01 19:23:46'
code: bare47qnm
permalink: /blog/bare47qnm/
tags:
  - MySQL
---

`mysqldump` 导出的是 SQL 文件。备份是否可用，要通过独立测试库的恢复来判断，不能只看文件已生成。

## 准备连接配置

安装与服务端兼容的 MySQL 客户端，确认 `mysqldump --version` 可用。创建专用备份账号并授予所需权限，再运行：

```bash
mysql_config_editor set --login-path=backup --host=127.0.0.1 --user=backup_user --password
```

按提示输入密码。后面的命令使用 `--login-path=backup`，不会把明文密码放进命令参数。登录配置属于当前操作系统用户；计划任务必须使用能读到该配置的同一用户。

## 导出结构和数据

以已有数据库 `app_db` 为例，在有写权限的目录运行：

```bash
mysqldump --login-path=backup --single-transaction --routines --events --triggers --no-tablespaces --set-gtid-purged=OFF --result-file=app_db.sql app_db
```

`--single-transaction` 适用于 InnoDB 等事务表，备份期间不能并发修改表结构；非事务表不能靠它保证一致性。`--routines`、`--events` 和 `--triggers` 把相关对象纳入导出，实际权限以服务器错误和官方说明为准。

`--result-file` 由工具直接写文件，避免 Windows PowerShell 5.1 的 `>` 重定向将输出转换为 UTF-16。只备份结构加 `--no-data`；只备份表数据加 `--no-create-info`，还要按需决定是否导出触发器。

## Windows 计划任务脚本

把下面保存为 `backup.ps1`，修改客户端与备份目录：

```powershell
$dumpTool = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe'
$backupDirectory = 'D:\Backups\mysql'
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss_fff'
$outputFile = Join-Path $backupDirectory "app_db_$stamp.sql"
& $dumpTool --login-path=backup --single-transaction --routines --events --triggers --no-tablespaces --set-gtid-purged=OFF "--result-file=$outputFile" app_db
if ($LASTEXITCODE -ne 0) { throw "备份失败，退出码 $LASTEXITCODE；输出文件不能当作有效备份：$outputFile" }
Write-Output "备份完成：$outputFile"
```

在任务计划程序中指定同一用户，程序为 `powershell.exe`，参数为 `-NoProfile -File "D:\Scripts\backup.ps1"`。先手动执行一次，再检查任务运行结果。脚本没有自动删除历史备份。

## 恢复到测试库

由于导出命令未使用 `--databases`，SQL 不会自动切回原库。先创建空测试库，再进入它：

```bash
mysql --login-path=backup -e "CREATE DATABASE app_db_restore;"
mysql --login-path=backup app_db_restore
```

在 MySQL 客户端执行，路径填写实际备份位置，Windows 可用正斜杠：

```sql
SOURCE D:/Backups/mysql/app_db.sql;
SHOW TABLES;
```

恢复用户需要建库和导入权限，可以另建恢复用 login path。备份含存储过程或事件时，还需检查其中硬编码的原库名和 DEFINER。核对关键表行数、数据和对象后，才确认这份备份可恢复。

参考：[mysqldump](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html)、[mysql_config_editor](https://dev.mysql.com/doc/refman/8.4/en/mysql-config-editor.html)。
