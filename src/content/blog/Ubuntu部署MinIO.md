# Ubuntu 部署 MinIO（API:8071 / Console:8070）与 Python 接入实战：自启动、上传、下载、图片在线访问

本文按“能落地、可复现”的标准，把 MinIO 在 Ubuntu 上的安装部署、systemd 后台自启动、`mc` 管理以及 Python SDK 上传/下载/在线访问（预签名与公开读）走一遍。示例目录结构与端口配置与你当前环境一致：

- Server：`/opt/minio/server/minio`
- Client：`/opt/minio/client/mc`
- Data：`/opt/minio/data`
- S3 API：`8071`
- Console：`8070`

> 注意：Ubuntu 系统自带 `mc`（Midnight Commander 文件管理器），直接输入 `mc` 会进入蓝色双栏界面。MinIO 的客户端必须使用 **`./mc`**（在 `/opt/minio/client` 下）或 **`/opt/minio/client/mc`** 的绝对路径。

------

## 1. 目录规划与权限

### 1.1 目录结构

```
/opt/minio/
  server/   # minio server 二进制
  client/   # MinIO mc 二进制
  data/     # 数据目录（对象存储数据）
```

### 1.2 创建数据目录并设置权限

生产环境建议用专用用户运行（如 `minio-user`）。你的数据目录目前属于 `minio-user`，这是正确的方向。

```
sudo mkdir -p /opt/minio/data
sudo chown -R minio-user:minio-user /opt/minio/data
sudo chmod 750 /opt/minio/data
```

------

## 2. 安装 MinIO Server（二进制）

在 `/opt/minio/server` 目录下载并赋权：

```
cd /opt/minio/server
wget https://dl.minio.org.cn/server/minio/release/linux-amd64/minio
chmod +x minio
```

------

## 3. 前台启动验证（API=8071 / Console=8070）

先用前台方式验证参数与端口是否正确（确保不是 systemd/权限问题）：

```
cd /opt/minio/server

MINIO_ROOT_USER=admin MINIO_ROOT_PASSWORD='A12345678' \
./minio server /opt/minio/data \
  --address ":8071" \
  --console-address ":8070"
```

验证监听端口：

```
ss -lntp | egrep '8070|8071'
```

访问地址：

- Console：`http://<服务器IP>:8070`
- S3 API（SDK/接口）：`http://<服务器IP>:8071`

> `mc`、Python SDK、S3 兼容接口全部走 **8071**；8070 仅用于控制台页面。

------

## 4. 安装 MinIO Client（mc）并避免“系统 mc”冲突

### 4.1 下载 MinIO 的 mc

```
cd /opt/minio/client
wget https://dl.minio.org.cn/client/mc/release/linux-amd64/mc
chmod +x mc
```

### 4.2 强制使用 ./mc（关键点）

- 输入 `mc`：走 `/usr/bin/mc`（文件管理器）
- 输入 `./mc`：走当前目录的 MinIO 客户端

验证版本：

```
cd /opt/minio/client
./mc --version
```

------

## 5. systemd 后台运行 + 开机自启动

systemd 最稳的写法：把 `ExecStart` 参数写清楚，不依赖拼接变量，避免“参数没展开导致启动失败”。

### 5.1 创建 service 文件

写入 `/etc/systemd/system/minio.service`：

```
sudo tee /etc/systemd/system/minio.service >/dev/null <<'EOF'
[Unit]
Description=MinIO Object Storage
Wants=network-online.target
After=network-online.target

[Service]
User=minio-user
Group=minio-user
WorkingDirectory=/opt/minio

Environment="MINIO_ROOT_USER=admin"
Environment="MINIO_ROOT_PASSWORD=A12345678"

ExecStart=/opt/minio/server/minio server /opt/minio/data --address :8071 --console-address :8070

Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
```

### 5.2 启动并设置开机自启

```
sudo systemctl daemon-reload
sudo systemctl enable --now minio
sudo systemctl status minio --no-pager
```

查看日志（排障首选）：

```
journalctl -u minio -f
```

确认端口：

```
ss -lntp | egrep '8070|8071'
```

------

## 6. 用 mc 初始化：alias、建桶、创建业务密钥、上传/下载

以下操作全部用 **MinIO 的 `./mc`**。

### 6.1 绑定别名（alias）

```
cd /opt/minio/client

./mc alias set myminio http://127.0.0.1:8071 admin 'A12345678'
./mc admin info myminio
```

### 6.2 创建桶（bucket）

```
./mc mb myminio/images
./mc ls myminio
```

### 6.3 创建业务用户（AccessKey/SecretKey）

业务系统不应长期使用 root（`admin`），建议为每个应用创建独立 AK/SK。

```
./mc admin user add myminio imgapp 'ImgAppSecret@123'
```

此时：

- AccessKey：`imgapp`
- SecretKey：`ImgAppSecret@123`

### 6.4 授权（先跑通再收口）

先用 readwrite 跑通：

```
./mc admin policy attach myminio readwrite --user imgapp
```

### 6.5 上传与下载（mc）

对象存储“目录”本质是 object key 的前缀：

```
# 上传
./mc cp ./test.jpg myminio/images/uploads/2026/02/27/test.jpg

# 列表
./mc ls myminio/images/uploads/2026/02/27/

# 下载
./mc cp myminio/images/uploads/2026/02/27/test.jpg ./test-down.jpg
```

------

## 7. Python SDK：上传、下载、图片访问

### 7.1 安装 SDK

```
pip3 install minio
```

### 7.2 初始化 Client（HTTP + 8071）

> endpoint 建议写 `host:port`，并设置 `secure=False`（因为你当前是 http）。

```
from minio import Minio

client = Minio(
    "127.0.0.1:8071",
    access_key="imgapp",
    secret_key="ImgAppSecret@123",
    secure=False,
)
```

### 7.3 上传文件（fput_object）

```
from minio import Minio
from datetime import datetime

client = Minio(
    "127.0.0.1:8071",
    access_key="imgapp",
    secret_key="ImgAppSecret@123",
    secure=False,
)

bucket = "images"
if not client.bucket_exists(bucket):
    client.make_bucket(bucket)

local_path = "/tmp/test.jpg"
object_key = "uploads/{:%Y/%m/%d}/test.jpg".format(datetime.now())

client.fput_object(
    bucket_name=bucket,
    object_name=object_key,
    file_path=local_path,
    content_type="image/jpeg",
)

print("uploaded:", bucket, object_key)
```

### 7.4 下载文件（fget_object）

```
client.fget_object(
    bucket_name="images",
    object_name="uploads/2026/02/27/test.jpg",
    file_path="/tmp/test-down.jpg",
)
print("download ok")
```

------

## 8. 图片在线访问：两种常用方案

### 方案 A：预签名 URL（私有桶推荐）

不开放匿名访问，通过临时 URL 直接在浏览器打开图片。

```
from datetime import timedelta

url = client.presigned_get_object(
    bucket_name="images",
    object_name="uploads/2026/02/27/test.jpg",
    expires=timedelta(minutes=30),
)
print(url)
```

输出的 URL 直接用浏览器访问即可，30 分钟后失效。

### 方案 B：公开读（简单但有风险）

把桶设置为匿名下载：

```
cd /opt/minio/client
./mc anonymous set download myminio/images
```

此时图片可通过路径风格 URL 访问（无反代时）：

```
http://<服务器IP>:8071/images/uploads/2026/02/27/test.jpg
```

> 公开读适合明确“对外公开”的资源；内部系统或敏感图片建议使用预签名 URL 或在网关层做鉴权。

------

## 9. 常见问题与排查清单

### 9.1 输入 `mc` 进入蓝色界面

这是系统文件管理器。MinIO 客户端必须用：

```
cd /opt/minio/client
./mc --version
```

### 9.2 `mc` 连不上

确认连的是 **8071**（S3 API），不是 8070（Console）：

```
ss -lntp | egrep '8070|8071'
```

### 9.3 systemd 启动失败（端口不监听）

先看状态与日志：

```
sudo systemctl status minio --no-pager
sudo journalctl -u minio -n 200 --no-pager
```

重点检查：

- `/opt/minio/server/minio` 是否可执行
- `minio-user` 是否能读写 `/opt/minio/data`
- 端口是否被占用

------

## 10. 最小可用结果（验收标准）

满足以下几点，说明部署链路完整：

1. `systemctl status minio` 为 active (running)
2. `ss -lntp | egrep '8070|8071'` 能看到监听
3. `./mc admin info myminio` 返回信息
4. Python `fput_object` 上传成功，`fget_object` 下载成功
5. 预签名 URL 或公开读 URL 可以在浏览器打开图片