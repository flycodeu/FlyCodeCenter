"""Standalone Hikvision integration workbench. Python 3.10+, standard library only."""
import argparse
import base64
import errno
import hashlib
import hmac
import ipaddress
import json
import os
import secrets
import socket
import sqlite3
import ssl
import time
import threading
import uuid
from datetime import datetime, timezone
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, HTTPSHandler, ProxyHandler, Request, build_opener
from event_store import Store
from delivery import Delivery
from feishu import Feishu, card_fields, make_card

ROOT = Path(__file__).resolve().parent
APIS = {
    "search": "/artemis/api/resource/v2/camera/search",
    "subscribe": "/artemis/api/eventService/v1/eventSubscriptionByEventTypes",
    "subscriptions": "/artemis/api/eventService/v1/eventSubscriptionView",
    "unsubscribe": "/artemis/api/eventService/v1/eventUnSubscriptionByEventTypes",
    "picture": "/artemis/api/video/v1/events/picture",
}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def subscription_revision(result):
    if str(result.get("code")) != "0" or not isinstance(result.get("data", {}).get("detail"), list):
        raise ValueError("无法核对订阅列表，请先解决查询权限或平台返回错误")
    rows = sorted((str(row.get("eventDest", "")), sorted(row.get("eventTypes", [])))
                  for row in result["data"]["detail"])
    return hashlib.sha256(encode(rows)).hexdigest()


def origin_url(value):
    parsed = urlsplit(value.rstrip("/"))
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        raise ValueError("部署地址必须是 http(s)://主机[:端口]，不含路径")
    return value.rstrip("/")


def signed_headers(key, secret, path):
    # Omit Content-MD5 and Date entirely, as allowed by the site's signing protocol.
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Ca-Key": key,
        "X-Ca-Nonce": str(uuid.uuid4()),
        "X-Ca-Timestamp": str(int(time.time() * 1000)),
    }
    signing = {k.lower(): v for k, v in headers.items() if k.startswith("X-Ca-")}
    names = sorted(signing)
    canonical = "POST\napplication/json\napplication/json\n"
    canonical += "".join(f"{k}:{signing[k]}\n" for k in names) + path
    headers["X-Ca-Signature-Headers"] = ",".join(names)
    headers["X-Ca-Signature"] = base64.b64encode(
        hmac.new(secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).digest()
    ).decode("ascii")
    return headers


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ImageRedirect(HTTPRedirectHandler):
    max_redirections = 3
    max_repeats = 2

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urlsplit(newurl)
        if req.get_method() != "GET" or parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("图片跳转目标必须为不含账号密码的 HTTP/HTTPS 地址")
        if req.full_url.startswith("https:") and parsed.scheme == "http":
            raise ValueError("图片服务跳转会将 HTTPS 降为 HTTP，请核对图片服务配置")
        # Cross-server image redirects carry no platform/Feishu authentication headers.
        return Request(newurl, headers={"Accept": "image/*"}, method="GET")


def remote(url, body=None, headers=None, insecure=False, ca_file=None, limit=10 * 1024 * 1024, method=None, error_json=False, follow_redirects=False):
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("只支持不含用户名和密码的 HTTP/HTTPS 地址")
    context = ssl.create_default_context(cafile=ca_file)
    if insecure:
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    if follow_redirects and (body is not None or method not in (None, "GET")):
        raise ValueError("只允许图片 GET 请求跟随跳转")
    handlers = [ImageRedirect() if follow_redirects else NoRedirect(), HTTPSHandler(context=context)]
    try:
        if ipaddress.ip_address(parsed.hostname).is_private:
            handlers.append(ProxyHandler({}))  # Internal image/API IPs must not go through an Internet proxy.
    except ValueError:
        pass
    opener = build_opener(*handlers)
    req = Request(url, data=body, headers=headers or {}, method=method or ("POST" if body is not None else "GET"))
    try:
        with opener.open(req, timeout=20) as response:
            result = response.read(limit + 1)
            if len(result) > limit:
                raise ValueError("响应超过大小限制")
            return result, response.headers.get_content_type()
    except HTTPError as exc:
        if error_json:
            try:
                raw = exc.read(64 * 1024 + 1)
                result = json.loads(raw) if len(raw) <= 64 * 1024 else None
                if isinstance(result, dict) and "code" in result:
                    # Opt-in callers format and redact the API error, never the request.
                    result["_http_status"] = exc.code
                    return encode(result), "application/json"
            except (ValueError, UnicodeDecodeError):
                pass
        # Never expose request headers, credentials or a signed image URL in errors.
        raise ValueError(f"远端返回 HTTP {exc.code}；请核对地址、接口授权和服务状态") from None
    except (URLError, ssl.SSLError, TimeoutError, OSError) as exc:
        cause = getattr(exc, "reason", exc)
        if getattr(cause, "errno", None) in (errno.EHOSTUNREACH, errno.ENETUNREACH):
            raise ValueError("网络不可达（No route to host）；请检查路由及网络防火墙") from None
        reason = str(cause)
        if "CERTIFICATE_VERIFY_FAILED" in reason or "certificate verify" in reason.lower():
            raise ValueError("证书校验失败：使用 --ca-file 指定可信证书，或明确勾选本次联调允许自签证书") from None
        raise ValueError("远端连接失败或超时，请检查网络、端口和服务状态") from None


def platform_call(action, payload, ca_file=None):
    base = str(payload.get("platform", "")).strip().rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme != "https" or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username:
        raise ValueError("平台地址必须为 https://IP:端口，不含路径")
    key, secret = payload.get("appKey", ""), payload.get("appSecret", "")
    if not isinstance(key, str) or not isinstance(secret, str) or not key.strip() or not secret:
        raise ValueError("请填写 AppKey 和 AppSecret")
    if any(c in key for c in "\r\n"):
        raise ValueError("AppKey 格式不正确")
    body = payload.get("body", {})
    if not isinstance(body, dict):
        raise ValueError("请求 body 必须为对象")
    if action == "unsubscribe":
        event_types = body.get("eventTypes")
        if event_types not in ([192517], [192518], [192517, 192518]) or set(body) != {"eventTypes"}:
            raise ValueError("只能按温度/温差事件类型取消，不支持按相机或回调地址取消")
        if payload.get("confirmed") is not True or not payload.get("subscriptionRevision"):
            raise ValueError("请先查询订阅并确认取消范围")
        current = platform_call("subscriptions", {**payload, "body": {}}, ca_file)
        if subscription_revision(current) != payload["subscriptionRevision"]:
            raise ValueError("订阅列表已变化，本次未取消；请重新查询后确认")
        if not any(set(row.get("eventTypes", [])) & set(event_types) for row in current["data"]["detail"]):
            raise ValueError("当前查询结果中没有所选测温订阅，本次未取消")
    if action == "subscribe":
        dest = urlsplit(str(body.get("eventDest", "")))
        if dest.scheme not in ("http", "https") or not dest.hostname or dest.username or dest.fragment:
            raise ValueError("请填写有效的回调 HTTP/HTTPS 地址")
        if dest.hostname.lower() == "localhost":
            raise ValueError("回调必须填写海康服务器可以访问的本机内网地址")
        try:
            if ipaddress.ip_address(dest.hostname).is_loopback:
                raise ValueError("回调不能使用回环地址")
        except ValueError as exc:
            if "回环" in str(exc):
                raise
        if body.get("eventTypes") not in ([192517], [192517, 192518]):
            raise ValueError("此页面只支持温度及温差事件")
        if type(body.get("subType")) is not int or body["subType"] not in (0, 1, 2):
            raise ValueError("请选择原始事件、联动事件或两者")
    path = APIS[action]
    data, _ = remote(base + path, encode(body), signed_headers(key.strip(), secret, path),
                     payload.get("insecure") is True, ca_file, limit=4 * 1024 * 1024)
    try:
        return json.loads(data)
    except (ValueError, UnicodeDecodeError):
        raise ValueError("平台未返回有效 JSON") from None


class WorkbenchServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, db_file, ca_file=None, public_url=None, admin_token=None, admin_origin=None, start_worker=False):
        super().__init__(address, Handler)
        self.db_file, self.ca_file = str(db_file), ca_file
        self.public_url = origin_url(public_url) if public_url else None
        self.admin_origin = origin_url(admin_origin or public_url) if admin_token and (admin_origin or public_url) else None
        if admin_token and (not self.admin_origin or len(admin_token) < 24):
            raise ValueError("远程管理需要部署地址和至少 24 位随机管理口令")
        self.admin_token = admin_token
        self.sessions = {}
        self.login_attempts = {}
        self.auth_lock = threading.Lock()
        self.subscription_lock = threading.Lock()
        self.test_push_lock = threading.Lock()
        self.token = secrets.token_urlsafe(32)
        Path(db_file).parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with closing(sqlite3.connect(self.db_file)) as db, db:
            db.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            db.execute("INSERT OR IGNORE INTO meta VALUES ('callback', ?)", (secrets.token_urlsafe(24),))
            self.callback_path = "/callback/" + db.execute("SELECT value FROM meta WHERE key='callback'").fetchone()[0]
            db.execute("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, received TEXT, payload TEXT)")
        self.store = Store(db_file)
        with self.store.connect() as db:
            if not db.execute("SELECT 1 FROM meta WHERE key='alarms_migrated'").fetchone():
                for row in db.execute("SELECT received,payload FROM messages ORDER BY id").fetchall():
                    self.store.ingest(db, json.loads(row["payload"]), row["received"], historical=True)
                db.execute("INSERT INTO meta VALUES ('alarms_migrated','1')")
        self.delivery = Delivery(self.store, remote, platform_call, ca_file)
        if start_worker:
            self.delivery.start()

    def server_close(self):
        if hasattr(self, "delivery"):
            self.delivery.close()
        super().server_close()

    def configured_payload(self, payload):
        if payload.get("useSavedSecret") is True:
            saved = self.store.settings()["hik"]
            if payload.get("platform", "").rstrip("/") != saved["platform"].rstrip("/") or payload.get("appKey") != saved["appKey"]:
                raise ValueError("平台或 AppKey 已更改，请重新输入密钥")
            return {**payload, "appSecret": saved["appSecret"]}
        return payload


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Avoid logging credentials, callback paths, or signed image URLs.

    def send(self, status, body, content_type="application/json; charset=utf-8", headers=None):
        raw = encode(body) if not isinstance(body, bytes) else body
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(raw)

    def local_access(self, mutation=False):
        port = self.server.server_port
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        local = (self.client_address[0] == "127.0.0.1" and self.headers.get("Host") in hosts
                 and not self.headers.get("X-Forwarded-For") and not self.headers.get("Forwarded"))
        admin_origin = self.server.admin_origin
        remote_admin = admin_origin and self.headers.get("Host") == urlsplit(admin_origin).netloc
        if not local:
            if not remote_admin:
                self.send(403, {"error": "未启用此地址的远程管理，请使用本机地址或配置管理口令"})
                return False
            with self.server.auth_lock:
                authenticated = self.server.sessions.get(self.session_id(), 0) > time.time()
            if not authenticated:
                if self.path == "/" and self.command == "GET":
                    self.send(200, (ROOT / "login.html").read_bytes(), "text/html; charset=utf-8")
                else:
                    self.send(401, {"error": "管理会话已过期，请重新打开页面登录"})
                return False
        origin = self.headers.get("Origin")
        allowed_origins = {f"http://{h}" for h in hosts} if local else {admin_origin}
        if origin and origin not in allowed_origins:
            self.send(403, {"error": "不允许跨站请求"})
            return False
        if mutation and not secrets.compare_digest(self.headers.get("X-Workbench-Token", ""), self.server.token):
            self.send(403, {"error": "页面会话已变化，请刷新页面"})
            return False
        return True

    def session_id(self):
        try:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            return cookie["hik_workbench"].value if "hik_workbench" in cookie else ""
        except Exception:
            return ""

    def login(self):
        origin = self.server.admin_origin
        if not origin or self.headers.get("Host") != urlsplit(origin).netloc or self.headers.get("Origin") != origin:
            self.send(403, {"error": "管理入口或来源不匹配"})
            return
        payload = self.read_json()
        now, peer = time.time(), self.client_address[0]
        with self.server.auth_lock:
            self.server.login_attempts = {k: v for k, v in self.server.login_attempts.items() if v[1] > now - 60}
            count, _ = self.server.login_attempts.get(peer, (0, now))
            if count >= 5 or len(self.server.login_attempts) >= 1024:
                self.send(429, {"error": "尝试过于频繁，请一分钟后重试"})
                return
            self.server.login_attempts[peer] = (count + 1, now)
            supplied = payload.get("token")
            if not isinstance(supplied, str) or not secrets.compare_digest(supplied.encode(), self.server.admin_token.encode()):
                self.send(401, {"error": "管理口令不正确"})
                return
            self.server.login_attempts.pop(peer, None)
            self.server.sessions = {k: v for k, v in self.server.sessions.items() if v > now}
            if len(self.server.sessions) >= 128:
                self.send(429, {"error": "管理会话过多，请稍后重试"})
                return
            session = secrets.token_urlsafe(32)
            self.server.sessions[session] = now + 8 * 3600
        secure = "; Secure" if origin.startswith("https:") else ""
        self.send(200, {"ok": True}, headers={"Set-Cookie": f"hik_workbench={session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800{secure}"})

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= 2 * 1024 * 1024:
            raise ValueError("请求体为空或超过 2 MB")
        self.connection.settimeout(15)
        result = json.loads(self.rfile.read(length))
        if not isinstance(result, dict):
            raise ValueError("JSON 必须为对象")
        return result

    def do_GET(self):
        if not self.local_access():
            return
        if self.path == "/":
            html = (ROOT / "index.html").read_text(encoding="utf-8").replace("__WORKBENCH_TOKEN__", self.server.token, 1)
            self.send(200, html.encode("utf-8"), "text/html; charset=utf-8")
        elif self.path == "/workbench.js":
            self.send(200, (ROOT / "workbench.js").read_bytes(), "text/javascript; charset=utf-8")
        elif self.path == "/api/info":
            try:
                ips = sorted({i[4][0] for i in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
                              if not ipaddress.ip_address(i[4][0]).is_loopback
                              and not ipaddress.ip_address(i[4][0]).is_link_local})
            except OSError:
                ips = []
            self.send(200, {"callbackPath": self.server.callback_path, "port": self.server.server_port, "ips": ips,
                            "callbackUrl": (self.server.public_url + self.server.callback_path) if self.server.public_url else None,
                            "remoteAdmin": bool(self.session_id())})
        elif self.path == "/api/events":
            with closing(sqlite3.connect(self.server.db_file)) as db, db:
                rows = db.execute("SELECT id,received,payload FROM messages ORDER BY id DESC LIMIT 100").fetchall()
                total = db.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
            self.send(200, {"total": total, "alarms": self.server.store.list_alarms(),
                            "messages": [{"id": r[0], "received": r[1], "payload": json.loads(r[2])} for r in rows]})
        elif self.path == "/api/settings":
            self.send(200, self.server.store.settings(public=True))
        elif self.path.startswith("/api/images/") and self.path[12:].isdigit():
            with self.server.store.connect() as db:
                image = db.execute("SELECT content,mime FROM images WHERE id=?", (int(self.path[12:]),)).fetchone()
            if image and image["content"]:
                self.send(200, image["content"], image["mime"])
            else:
                self.send(404, {"error": "图片尚未保存"})
        elif self.path.startswith("/api/alarms/") and self.path[12:].isdigit():
            with self.server.store.connect() as db:
                row = db.execute("SELECT content,raw,received FROM alarms WHERE id=?", (int(self.path[12:]),)).fetchone()
            if row:
                self.send(200, {"event": json.loads(row["content"]), "raw": json.loads(row["raw"]), "received": row["received"]})
            else:
                self.send(404, {"error": "事件不存在"})
        else:
            self.send(404, {"error": "地址不存在"})

    def do_POST(self):
        if self.path == "/api/login":
            try:
                self.login()
            except (ValueError, TypeError):
                self.send(400, {"error": "登录请求格式不正确"})
            return
        is_callback = self.path == self.server.callback_path
        if not is_callback and not self.local_access(mutation=True):
            return
        try:
            payload = self.read_json()
            if is_callback:
                if self.headers.get("Origin"):
                    self.send(403, {"error": "回调仅接收服务端投递"})
                    return
                params = payload.get("params")
                if payload.get("method") != "OnEventNotify" or not isinstance(params, dict) or not isinstance(params.get("events"), list):
                    raise ValueError("回调需要 OnEventNotify 和 params.events 数组")
                if not params["events"] or any(not isinstance(e, dict) for e in params["events"]):
                    raise ValueError("events 必须为非空对象数组")
                received = datetime.now(timezone.utc).isoformat()
                with self.server.store.connect() as db:
                    db.execute("INSERT INTO messages(received,payload) VALUES (?,?)", (received, encode(payload).decode("utf-8")))
                    self.server.store.ingest(db, payload, received)
                # Provisional acknowledgment; validate against the deployed Hikvision event service.
                self.send(200, {"code": "0", "msg": "success"})
            elif self.path.startswith("/api/") and self.path[5:] in APIS:
                action = self.path[5:]
                with self.server.subscription_lock:
                    result = platform_call(action, self.server.configured_payload(payload), self.server.ca_file)
                if action == "subscriptions" and str(result.get("code")) == "0":
                    result["workbenchRevision"] = subscription_revision(result)
                self.send(200, result)
            elif self.path == "/api/settings":
                callback = payload.get("callbackUrl")
                if callback:
                    parsed = urlsplit(callback)
                    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.path != self.server.callback_path or parsed.query or parsed.fragment or parsed.username:
                        raise ValueError("回调地址必须保留当前接收服务的路径")
                self.send(200, self.server.store.save(payload))
            elif self.path == "/api/push-toggle":
                if type(payload.get("enabled")) is not bool:
                    raise ValueError("推送开关格式不正确")
                self.send(200, self.server.store.save({"feishu": {"enabled": payload["enabled"]}}))
            elif self.path == "/api/feishu-test":
                if payload:
                    raise ValueError("测试推送只使用已保存的飞书配置，请先保存配置")
                if not self.server.test_push_lock.acquire(blocking=False):
                    raise ValueError("已有测试消息正在发送，请等待结果")
                try:
                    config = self.server.store.settings()["feishu"]
                    fields = ("baseUrl", "appId", "appSecret", "receiveIdType", "receiveId")
                    def unchanged():
                        current = self.server.store.settings()["feishu"]
                        return all(current[k] == config[k] for k in fields)
                    message_id = Feishu(remote).send_test(config, unchanged)
                    self.send(200, {"ok": True, "messageId": message_id, "receiveId": config["receiveId"]})
                finally:
                    self.server.test_push_lock.release()
            elif self.path == "/api/push-retry":
                self.server.store.retry(int(payload["alarmId"]))
                self.send(200, {"ok": True})
            elif self.path == "/api/image-retry":
                self.server.store.retry_images(int(payload["alarmId"]))
                self.send(200, {"ok": True})
            elif self.path == "/api/card-preview":
                alarm = next((a for a in self.server.store.list_alarms() if a["id"] == int(payload["alarmId"])), None)
                if not alarm:
                    raise ValueError("事件不在最近记录中")
                self.send(200, {"title": alarm["eventTypeName"], "fields": card_fields(alarm), "images": alarm["images"], "card": make_card(alarm)})
            elif self.path == "/api/logout":
                with self.server.auth_lock:
                    self.server.sessions.pop(self.session_id(), None)
                self.send(200, {"ok": True}, headers={"Set-Cookie": "hik_workbench=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"})
            elif self.path == "/api/image":
                data, kind = remote(str(payload.get("url", "")), insecure=payload.get("insecure") is True, ca_file=self.server.ca_file, follow_redirects=True)
                if kind not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
                    raise ValueError("图片服务未返回支持的图片类型")
                self.send(200, data, kind)
            else:
                self.send(404, {"error": "地址不存在"})
        except (ValueError, TypeError, KeyError, UnicodeDecodeError) as exc:
            # Only our controlled validation errors are presented; parse errors may include input.
            message = str(exc) if type(exc) is ValueError else "请求格式不正确"
            self.send(400, {"error": message})
        except Exception:
            self.send(500, {"error": "本地服务处理失败，请检查证书文件、磁盘空间或服务配置"})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8769)
    parser.add_argument("--bind", default="0.0.0.0", help="Listen address; remote administration requires --admin-token-env")
    parser.add_argument("--ca-file", help="Trusted PEM CA bundle for the Hikvision platform and image servers")
    parser.add_argument("--public-url", help="Callback origin visible to Hikvision, e.g. http://10.20.0.40:8769")
    parser.add_argument("--admin-origin", help="Browser origin for remote administration; defaults to --public-url")
    parser.add_argument("--admin-token-env", help="Environment variable containing a random remote admin token (24+ characters)")
    parser.add_argument("--data-dir", type=Path, default=ROOT / ".runtime", help="SQLite data directory")
    args = parser.parse_args()
    admin_token = os.environ.get(args.admin_token_env) if args.admin_token_env else None
    if args.admin_token_env and not admin_token:
        parser.error("指定的管理口令环境变量为空")
    try:
        server = WorkbenchServer((args.bind, args.port), args.data_dir / "events.sqlite3", args.ca_file,
                                 args.public_url, admin_token, args.admin_origin, start_worker=True)
    except ValueError as exc:
        parser.error(str(exc))
    print(f"Open http://127.0.0.1:{server.server_port}  (Ctrl+C to stop)", flush=True)
    print("Configuration, alarms and images are saved in the configured SQLite data directory.", flush=True)
    if server.public_url:
        print(f"Callback: {server.public_url}{server.callback_path}", flush=True)
    if server.admin_origin:
        print(f"Remote management: {server.admin_origin} (login required)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
