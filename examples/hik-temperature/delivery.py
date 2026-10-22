"""One bounded background worker; callbacks only commit data and acknowledge."""
import json
import threading
import time
import uuid
from urllib.parse import urlsplit
from event_store import eligible, profile_key
from feishu import Feishu


class Delivery:
    def __init__(self, store, transport, platform_call, ca_file=None):
        self.store, self.transport, self.platform_call, self.ca_file = store, transport, platform_call, ca_file
        self.feishu = Feishu(transport)
        self.stop = threading.Event()
        self.thread = None

    def start(self):
        self.thread = threading.Thread(target=self.run, name="alarm-delivery", daemon=True)
        self.thread.start()

    def close(self):
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=25)

    def run(self):
        while not self.stop.is_set():
            try:
                self.once()
            except Exception:
                # A temporary DB/IO failure must not terminate background delivery.
                pass
            self.stop.wait(1)

    def allowed(self, alarm, profile):
        settings = self.store.settings()
        return eligible(settings, alarm) and profile_key(settings) == profile

    def fetch_image(self, image):
        config = self.store.settings()["hik"]
        uri = image["uri"]
        parsed = urlsplit(uri)
        if parsed.scheme.lower() in ("http", "https"):
            try:
                return self.download_image(uri, config)
            except ValueError as error:
                # Expired signed URLs can be refreshed through the official picture API.
                refreshable = any(part in str(error) for part in ("HTTP 401", "HTTP 403", "HTTP 404", "HTTP 410", "图片响应格式不正确"))
                if not image["server_code"] or not refreshable:
                    raise
            pic_uri = parsed.path + ("?" + parsed.query if parsed.query else "")
        else:
            pic_uri = uri
        if not image["server_code"]:
            raise ValueError("图片地址换取失败：相对 URI 缺少 imageServerCode / picServerIndexCode")
        try:
            result = self.platform_call("picture", {**config, "body": {"svrIndexCode": image["server_code"], "picUri": pic_uri,
                                         "netProtocol": parsed.scheme if parsed.scheme in ("http", "https") else "https"}}, self.ca_file)
        except ValueError as error:
            raise ValueError(f"海康图片地址换取失败：{error}") from None
        if str(result.get("code")) != "0":
            raise ValueError(f'海康图片地址换取失败，错误码 {str(result.get("code", "未提供"))[:64]}；请检查视频事件图片接口授权')
        resolved = result.get("data", {}).get("picUrl")
        if not isinstance(resolved, str) or not resolved.startswith(("http://", "https://")):
            raise ValueError("海康图片接口未返回有效 data.picUrl")
        return self.download_image(resolved, config)

    def download_image(self, uri, config):
        parsed = urlsplit(uri)
        host = f'{parsed.hostname}:{parsed.port or (443 if parsed.scheme == "https" else 80)}'
        try:
            content, mime = self.transport(uri, headers={"Accept": "image/*"}, insecure=config["insecure"], ca_file=self.ca_file, follow_redirects=True)
        except ValueError as error:
            raise ValueError(f"图片下载失败（{host}）：{error}") from None
        signatures = {"image/jpeg": content.startswith(b"\xff\xd8\xff"), "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
                      "image/gif": content.startswith((b"GIF87a", b"GIF89a")), "image/webp": content[:4] == b"RIFF" and content[8:12] == b"WEBP"}
        if mime in ("application/octet-stream", "binary/octet-stream", ""):
            mime = next((kind for kind, matches in signatures.items() if matches), mime)
        if not signatures.get(mime):
            raise ValueError(f"图片响应格式不正确（{host}，{mime}）；请检查地址是否过期或被代理拦截")
        return content, mime

    def once(self):
        now = time.time()
        with self.store.connect() as db:
            image = db.execute("SELECT * FROM images WHERE content IS NULL AND attempts<3 AND next_try<=? ORDER BY id LIMIT 1", (now,)).fetchone()
        if image:
            try:
                content, mime = self.fetch_image(image)
                with self.store.connect() as db:
                    db.execute("UPDATE images SET content=?,mime=?,error='' WHERE id=?", (content, mime, image["id"]))
            except Exception as error:
                with self.store.connect() as db:
                    db.execute("UPDATE images SET attempts=attempts+1,next_try=?,error=? WHERE id=?",
                               (now + 10 * (image["attempts"] + 1), str(error) if type(error) is ValueError else "图片获取失败", image["id"]))
        if self.stop.is_set():
            return
        with self.store.connect() as db:
            db.execute("UPDATE alarms SET push_state='pending' WHERE push_state='sending' AND next_try<?", (now,))
            row = db.execute("""SELECT * FROM alarms a WHERE push_state IN ('pending','failed') AND attempts<3 AND next_try<=?
                AND NOT EXISTS(SELECT 1 FROM images i WHERE i.alarm_id=a.id AND i.content IS NULL AND i.attempts<3)
                ORDER BY id LIMIT 1""", (now,)).fetchone()
            if not row:
                return
            claimed = db.execute("UPDATE alarms SET push_state='sending',next_try=? WHERE id=? AND push_state IN ('pending','failed') AND revision=?",
                                 (now+600, row["id"], row["revision"])).rowcount
        if not claimed:
            return
        alarm = json.loads(row["content"])
        if not self.allowed(alarm, row["push_profile"]):
            with self.store.connect() as db:
                db.execute("UPDATE alarms SET push_state='cancelled',error='推送关闭或接收配置已更改' WHERE id=? AND revision=?", (row["id"], row["revision"]))
            return
        try:
            config = self.store.settings()["feishu"]
            with self.store.connect() as db:
                images = db.execute("SELECT * FROM images WHERE alarm_id=? ORDER BY id", (row["id"],)).fetchall()
            request_id = str(uuid.uuid5(uuid.NAMESPACE_URL, row["dedup_key"] + row["push_profile"]))
            message_id = self.feishu.send(config, alarm, images, row["message_id"], request_id,
                                          lambda: self.allowed(alarm, row["push_profile"]) and not self.stop.is_set())
            with self.store.connect() as db:
                # Preserve a concurrent update: the next pass updates the already-sent card.
                db.execute("UPDATE alarms SET message_id=?,sent_revision=?,push_state=CASE WHEN revision=? THEN 'sent' ELSE push_state END,error='' WHERE id=?",
                           (message_id, row["revision"], row["revision"], row["id"]))
        except Exception as error:
            with self.store.connect() as db:
                state = "failed" if self.allowed(alarm, row["push_profile"]) else "cancelled"
                db.execute("UPDATE alarms SET push_state=?,attempts=attempts+1,next_try=?,error=? WHERE id=? AND revision=?",
                           (state, now+15*(row["attempts"]+1), str(error) if type(error) is ValueError else "飞书发送失败", row["id"], row["revision"]))
