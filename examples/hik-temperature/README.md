# 海康测温报警接收与飞书推送

Python 3.10+ 标准库，无需 pip 安装依赖。

## Windows 本机启动

```powershell
python server.py
```

打开 http://127.0.0.1:8769 。

## Ubuntu 服务器启动

```bash
export HIK_WORKBENCH_ADMIN_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
echo "管理口令：$HIK_WORKBENCH_ADMIN_TOKEN"
python3 server.py --port 8769 --public-url http://10.20.0.40:8769 --admin-token-env HIK_WORKBENCH_ADMIN_TOKEN
```

把示例地址改为实际服务器地址。通过浏览器登录后填写海康与飞书配置，保存，再测试推送和订阅。

选择设备原始测温事件时，将事件内容设为设备原始事件（subType=0）；需要平台联动信息可选1或2。

数据保存在 `.runtime/events.sqlite3`。更新程序时保留 `.runtime`，其中包含密钥、事件、图片及推送状态，勿放入公开下载包。

`deploy/hik-temperature.service` 是 systemd 模板，持续运行时按实际程序目录、数据目录和服务器地址配置。远程管理口令通过环境变量传入。

## 代码结构

- server.py：HTTP、管理登录、海康签名和接口、回调接收。
- event_store.py：配置和事件、图片状态持久化。
- delivery.py：后台图片下载、重试和飞书任务。
- feishu.py：飞书令牌、图片上传、卡片发送和更新。
- index.html / workbench.js：管理页面。

## 本地测试

```bash
python3 -m unittest -v test_server.py test_delivery.py
```

Windows 使用 python。测试使用临时数据库及模拟接口，不访问现场设备或发送真实飞书消息。
