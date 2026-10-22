"""SQLite configuration, normalized alarms and image/push state."""
import hashlib
import json
import os
import sqlite3
import time
import threading
from contextlib import contextmanager
from copy import deepcopy
from urllib.parse import urlsplit

DEFAULTS = {
    "hik": {"platform": "https://10.20.0.10:442", "appKey": "", "appSecret": "", "insecure": False, "subType": 1, "includeDifference": False},
    "camera": {"indexCode": "", "name": "", "location": ""},
    "callbackUrl": "",
    "feishu": {"enabled": False, "baseUrl": "https://open.feishu.cn", "appId": "", "appSecret": "",
               "receiveIdType": "chat_id", "receiveId": "", "allCameras": False},
}


def dumps(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def object_value(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return {}
    return value if isinstance(value, dict) else {}


def first(*values):
    return next((v for v in values if v is not None and v != ""), None)


def rules_of(event):
    data = object_value(event.get("data"))
    value = next((v for k, v in data.items() if k.strip() in ("thermometry", "thermometryDiff")), [])
    return [object_value(v) for v in (value if isinstance(value, list) else [value]) if v]


def normalize(event, camera=None):
    data, camera = object_value(event.get("data")), camera or {}
    rules = rules_of(event)
    source = first(event.get("srcIndex"), event.get("resIndexCode"), data.get("cameraIndexCode"),
                   next((object_value(r.get("targetAttrs")).get("cameraIndexCode") for r in rules if r.get("targetAttrs")), None))
    same_camera = source and source == camera.get("indexCode")
    level = first(event.get("eventLevelName"), event.get("eventLevelValue"), event.get("eventLvl"),
                  event.get("eventLevel"), data.get("eventLvl"), data.get("eventLevel"))
    level_text = {"0": "未配置", "1": "低", "2": "中", "3": "高"}.get(str(level), str(level) if level is not None else "未提供")
    images = []
    for item in [event, data, *rules]:
        attrs = object_value(item.get("targetAttrs"))
        code = first(item.get("imageServerCode"), item.get("svrIndexCode"), item.get("picServerIndexCode"),
                     attrs.get("imageServerCode"), attrs.get("picServerIndexCode"),
                     data.get("imageServerCode"), data.get("svrIndexCode"))
        for field, label in (("imageUrl", "热成像图"), ("visiblePicUrl", "可见光图"), ("picUrl", "事件图片")):
            uri = item.get(field)
            if isinstance(uri, str) and uri.strip():
                images.append({"uri": uri.strip(), "serverCode": code or "", "label": label})
        for picture in item.get("pics", []) if isinstance(item.get("pics"), list) else []:
            if isinstance(picture, dict) and first(picture.get("picUrl"), picture.get("url")):
                images.append({"uri": first(picture.get("picUrl"), picture.get("url")), "serverCode": picture.get("svrIndexCode", code or ""), "label": "事件图片"})
    unique_images = list({i["uri"]: i for i in images}.values())[:8]
    event_type = str(first(event.get("eventType"), data.get("eventType"), ""))
    return {
        "eventId": str(first(event.get("eventId"), event.get("eventLogId"), event.get("id")) or ""),
        "eventType": event_type, "eventTypeName": {"192517": "温度报警", "192518": "温差报警"}.get(event_type, str(event.get("eventTypeName", "其他事件"))),
        "sourceCode": str(source or ""), "sourceName": str(first(event.get("srcName"), event.get("resName"), camera.get("name") if same_camera else None, source, "未知相机")),
        "location": str(first(event.get("locationName"), event.get("regionPath"), event.get("regionName"), data.get("locationName"), data.get("regionName"), camera.get("location") if same_camera else None, "未提供")),
        "level": level_text, "ruleName": str(first(event.get("ruleName"), event.get("eventRuleName"), data.get("ruleName")) or ""),
        "happenTime": first(event.get("happenTime"), event.get("startTime"), data.get("dateTime"), ""),
        "endTime": event.get("endTime", ""), "status": event.get("status"),
        "measurements": [{"ruleId": r.get("ruleId"), "value": first(r.get("curTemperature"), r.get("curTemperatureDiff")),
                          "threshold": first(r.get("ruleTemperature"), r.get("ruleTemperatureDiff")), "unit": r.get("thermometryUnit"),
                          "quantity": "temperature" if r.get("curTemperature") is not None else "raw" if r.get("curTemperatureDiff") is not None else None} for r in rules],
        "images": unique_images,
    }


def profile_key(config):
    f = config["feishu"]
    return hashlib.sha256(dumps([f["baseUrl"], f["appId"], f["receiveIdType"], f["receiveId"]]).encode()).hexdigest()


def eligible(config, alarm):
    f = config["feishu"]
    return f["enabled"] and (f["allCameras"] or (bool(config["camera"]["indexCode"]) and alarm["sourceCode"] == config["camera"]["indexCode"]))


class Store:
    def __init__(self, path):
        self.path = str(path)
        self.settings_lock = threading.Lock()
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS alarms (
                    id INTEGER PRIMARY KEY, dedup_key TEXT UNIQUE NOT NULL, content TEXT NOT NULL,
                    raw TEXT NOT NULL, received TEXT NOT NULL, updated REAL NOT NULL,
                    revision INTEGER NOT NULL DEFAULT 1, push_state TEXT NOT NULL,
                    push_profile TEXT NOT NULL, message_id TEXT NOT NULL DEFAULT '',
                    attempts INTEGER NOT NULL DEFAULT 0, next_try REAL NOT NULL DEFAULT 0,
                    error TEXT NOT NULL DEFAULT '', sent_revision INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS images (
                    id INTEGER PRIMARY KEY, alarm_id INTEGER NOT NULL, uri TEXT NOT NULL,
                    server_code TEXT NOT NULL, label TEXT NOT NULL, mime TEXT, content BLOB,
                    attempts INTEGER NOT NULL DEFAULT 0, next_try REAL NOT NULL DEFAULT 0,
                    error TEXT NOT NULL DEFAULT '', UNIQUE(alarm_id,uri)
                );
                CREATE INDEX IF NOT EXISTS images_pending ON images(next_try,attempts);
                CREATE INDEX IF NOT EXISTS alarms_pending ON alarms(push_state,next_try);
            """)
            db.execute("INSERT OR IGNORE INTO settings VALUES (1,?)", (dumps(DEFAULTS),))
        if os.name != "nt":
            os.chmod(self.path, 0o600)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def settings(self, public=False):
        with self.connect() as db:
            saved = json.loads(db.execute("SELECT value FROM settings WHERE id=1").fetchone()[0])
        result = deepcopy(DEFAULTS)
        for key, value in saved.items():
            if isinstance(value, dict) and key in result:
                result[key].update(value)
            else:
                result[key] = value
        if public:
            for name in ("hik", "feishu"):
                result[name]["secretSaved"] = bool(result[name].pop("appSecret", ""))
        return result

    def save(self, patch):
        with self.settings_lock:
            return self._save(patch)

    def _save(self, patch):
        old, result = self.settings(), self.settings()
        for section in ("hik", "camera", "feishu"):
            incoming = patch.get(section, {})
            if not isinstance(incoming, dict):
                raise ValueError("配置格式不正确")
            for key, value in incoming.items():
                if key not in DEFAULTS[section]:
                    continue
                if key == "appSecret" and value == "":
                    continue  # Blank secret input retains the stored value.
                expected = type(DEFAULTS[section][key])
                if type(value) is not expected:
                    raise ValueError("配置字段类型不正确")
                if isinstance(value, str) and len(value) > 2048:
                    raise ValueError("配置字段过长")
                result[section][key] = value.strip() if isinstance(value, str) else value
            identity = ("platform", "appKey") if section == "hik" else ("baseUrl", "appId")
            if section in ("hik", "feishu") and old[section]["appSecret"] and any(result[section][k] != old[section][k] for k in identity) and not incoming.get("appSecret"):
                raise ValueError("更换平台地址或应用标识时，请重新输入对应密钥")
        if "callbackUrl" in patch:
            result["callbackUrl"] = str(patch["callbackUrl"]).strip()
        for address in (result["hik"]["platform"], result["feishu"]["baseUrl"]):
            parsed = urlsplit(address)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
                raise ValueError("平台与飞书 API 地址必须为 HTTPS 地址")
        if urlsplit(result["hik"]["platform"]).path not in ("", "/"):
            raise ValueError("海康平台地址不应包含路径")
        if result["hik"]["subType"] not in (0, 1, 2):
            raise ValueError("订阅类型不正确")
        f = result["feishu"]
        if f["receiveIdType"] not in ("chat_id", "user_id", "open_id", "union_id", "email"):
            raise ValueError("飞书接收人类型不正确")
        if f["enabled"]:
            if not all(f[k] for k in ("appId", "appSecret", "receiveId")):
                raise ValueError("开启推送需要飞书 App ID、Secret 和接收人")
            prefixes = {"chat_id": "oc_", "open_id": "ou_", "union_id": "on_"}
            if f["receiveIdType"] in prefixes and not f["receiveId"].startswith(prefixes[f["receiveIdType"]]):
                raise ValueError("飞书接收人 ID 格式不正确")
            if not f["allCameras"] and not result["camera"]["indexCode"]:
                raise ValueError("请先选择并保存推送相机，或选择全部相机")
        with self.connect() as db:
            db.execute("UPDATE settings SET value=? WHERE id=1", (dumps(result),))
            if not f["enabled"] or profile_key(old) != profile_key(result):
                db.execute("UPDATE alarms SET push_state='cancelled',error='推送关闭或接收配置已更改' WHERE push_state IN ('pending','failed')")
        return self.settings(public=True)

    def ingest(self, db, payload, received, historical=False):
        config = self.settings()
        for event in payload["params"]["events"]:
            alarm = normalize(event, config["camera"])
            if alarm["eventType"] not in ("192517", "192518"):
                continue
            identity = [alarm["sourceCode"], alarm["eventType"], alarm["eventId"]] if alarm["eventId"] else event
            key = hashlib.sha256(dumps(identity).encode()).hexdigest()
            old = db.execute("SELECT * FROM alarms WHERE dedup_key=?", (key,)).fetchone()
            state = "pending" if eligible(config, alarm) and not historical else ("filtered" if config["feishu"]["enabled"] and not historical else "disabled")
            if old:
                merged = json.loads(old["content"])
                for name, value in alarm.items():
                    if name == "images":
                        merged[name] = list({i["uri"]: i for i in [*merged[name], *value]}.values())[:8]
                    elif name == "measurements":
                        measurements = {str(m.get("ruleId")): m for m in merged[name]}
                        for measurement in value:
                            previous = measurements.setdefault(str(measurement.get("ruleId")), {})
                            previous.update({k: v for k, v in measurement.items() if v is not None})
                        merged[name] = list(measurements.values())
                    elif name == "sourceName" and value == alarm["sourceCode"] and merged.get(name):
                        continue
                    elif value not in (None, "", "未提供", [], "未知相机"):
                        merged[name] = value
                if dumps(merged) == old["content"]:
                    continue
                # A disabled/cancelled historical event is not silently replayed when enabling.
                if old["push_state"] in ("disabled", "filtered", "cancelled"):
                    state = old["push_state"]
                if old["push_profile"] != profile_key(config):
                    state = "cancelled"
                alarm = merged
                db.execute("UPDATE alarms SET content=?,raw=?,updated=?,revision=revision+1,push_state=?,attempts=0,next_try=?,error='' WHERE id=?",
                           (dumps(alarm), dumps(event), time.time(), state, time.time()+2, old["id"]))
                alarm_id = old["id"]
            else:
                alarm_id = db.execute("INSERT INTO alarms(dedup_key,content,raw,received,updated,push_state,push_profile,next_try) VALUES (?,?,?,?,?,?,?,?)",
                                      (key, dumps(alarm), dumps(event), received, time.time(), state, profile_key(config), time.time()+2)).lastrowid
            for image in alarm["images"]:
                db.execute("INSERT OR IGNORE INTO images(alarm_id,uri,server_code,label) VALUES (?,?,?,?)",
                           (alarm_id, image["uri"], str(image["serverCode"]), image["label"]))

    def list_alarms(self):
        with self.connect() as db:
            rows = db.execute("SELECT * FROM alarms ORDER BY id DESC LIMIT 100").fetchall()
            result = []
            for row in rows:
                alarm = json.loads(row["content"])
                alarm.update(id=row["id"], received=row["received"], revision=row["revision"], pushState=row["push_state"],
                             pushError=row["error"], messageId=row["message_id"])
                alarm["images"] = [{"id": i["id"], "label": i["label"], "ready": bool(i["ready"]), "error": i["error"],
                                    "url": f'/api/images/{i["id"]}' if i["ready"] else None}
                                   for i in db.execute("SELECT id,label,error,content IS NOT NULL AS ready FROM images WHERE alarm_id=?", (row["id"],))]
                result.append(alarm)
            return result

    def retry(self, alarm_id):
        with self.connect() as db:
            row = db.execute("SELECT * FROM alarms WHERE id=?", (alarm_id,)).fetchone()
            if not row:
                raise ValueError("事件不存在")
            config = self.settings()
            if not eligible(config, json.loads(row["content"])):
                raise ValueError("推送未开启，或事件不属于已配置的推送相机")
            if row["push_profile"] != profile_key(config):
                raise ValueError("接收配置已变化，不会将历史事件发送给新接收人")
            if row["push_state"] not in ("failed", "cancelled"):
                raise ValueError("仅失败或已取消的推送可以重试")
            db.execute("UPDATE alarms SET push_state='pending',attempts=0,next_try=0,error='' WHERE id=?", (alarm_id,))
            db.execute("UPDATE images SET attempts=0,next_try=0,error='' WHERE alarm_id=? AND content IS NULL", (alarm_id,))

    def retry_images(self, alarm_id):
        with self.connect() as db:
            db.execute("UPDATE images SET attempts=0,next_try=0,error='' WHERE alarm_id=? AND content IS NULL", (alarm_id,))
            row = db.execute("SELECT * FROM alarms WHERE id=?", (alarm_id,)).fetchone()
            config = self.settings()
            if row:
                alarm = json.loads(row["content"])
                # Re-read values missed by older versions, without replaying unrelated history.
                fresh = normalize(json.loads(row["raw"]), config["camera"])
                for measurement in fresh["measurements"]:
                    if measurement["value"] is not None:
                        previous = next((m for m in alarm["measurements"] if m.get("ruleId") == measurement.get("ruleId")), None)
                        if previous is not None:
                            previous.update({k: v for k, v in measurement.items() if v is not None})
                        else:
                            alarm["measurements"].append(measurement)
                db.execute("UPDATE alarms SET content=?,revision=revision+1 WHERE id=?", (dumps(alarm), alarm_id))
            if row and row["push_state"] in ("sent", "failed") and row["push_profile"] == profile_key(config) and eligible(config, json.loads(row["content"])):
                db.execute("UPDATE alarms SET push_state='pending',attempts=0,next_try=0,error='' WHERE id=?", (alarm_id,))
