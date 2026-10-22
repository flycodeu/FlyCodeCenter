"""Feishu application bot: token, image upload and interactive cards."""
import hashlib
import json
import re
import secrets
import struct
import time
import uuid
import zlib
from datetime import datetime
from urllib.parse import quote, urlencode


def plain(value):
    return str(value if value is not None else "未提供").replace("\r", " ").replace("\n", " ")[:500]


def provided(value):
    return value is not None and str(value).strip() not in ("", "未提供", "未配置", "未知相机", "None", "null")


def test_image():
    """Built-in PNG test pattern: no camera image or external download required."""
    width, height = 480, 240
    rows = []
    for y in range(height):
        row = bytearray(b"\0")
        for x in range(width):
            check = (125 <= x <= 205 and abs(y - (x - 5)) < 10) or (205 < x <= 355 and abs(y - (405 - x)) < 10)
            row.extend((255, 255, 255) if check else (32, 93 + y // 8, 71 + x // 16))
        rows.append(row)
    def chunk(kind, data):
        return struct.pack("!I", len(data)) + kind + data + struct.pack("!I", zlib.crc32(kind + data) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack("!2I5B", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows))) + chunk(b"IEND", b""))


def card_fields(alarm):
    status = {0: "瞬时", 1: "开始", 2: "结束", 4: "更新", 5: "图片补充"}.get(alarm.get("status"), "未提供")
    rows = [("事件来源", alarm["sourceName"]), ("地点", alarm["location"]),
            ("事件类型", alarm["eventTypeName"]), ("等级", alarm["level"]),
            ("发生时间", alarm["happenTime"]), ("状态", status)]
    if alarm.get("ruleName"):
        rows.append(("规则", alarm["ruleName"]))
    for measurement in alarm.get("measurements", []):
        if measurement.get("value") is not None:
            unit = {0: "℃", 1: "℉", 3: "K"}.get(measurement.get("unit"), "")
            rows.append(("温度" if measurement.get("quantity") == "temperature" else "测温原值", f'{measurement["value"]}{unit}'))
        if measurement.get("threshold") is not None:
            unit = {0: "℃", 1: "℉", 3: "K"}.get(measurement.get("unit"), "")
            rows.append(("报警阈值" if measurement.get("quantity") == "temperature" else "阈值原值", f'{measurement["threshold"]}{unit}'))
    return [(label, value) for label, value in rows if provided(value)]


def make_card(alarm, image_keys=()):
    # Plain-text nodes prevent callback text from becoming links or @ mentions.
    elements = [{"tag": "div", "text": {"tag": "plain_text", "content": "\n".join(f'{label}：{plain(value)}' for label, value in card_fields(alarm))}}]
    for label, key in image_keys:
        elements.append({"tag": "img", "img_key": key, "alt": {"tag": "plain_text", "content": label}, "mode": "fit_horizontal", "preview": True})
    # The 1.0 card structure supports plain_text divs and remains compatible with application messages.
    return {"config": {"wide_screen_mode": True, "update_multi": True},
            "header": {"template": {"低": "blue", "中": "orange", "高": "red"}.get(alarm["level"], "grey"),
                       "title": {"tag": "plain_text", "content": plain(alarm["eventTypeName"])}}, "elements": elements}


class Feishu:
    def __init__(self, transport):
        self.transport = transport
        self.tokens, self.image_keys = {}, {}
        self.sensitive = set()

    def send_test(self, config, allowed=lambda: True):
        if not all(config.get(k) for k in ("appId", "appSecret", "receiveId")):
            raise ValueError("请先填写并保存飞书 App ID、App Secret 和接收人")
        alarm = {"sourceName": "测温接收系统 · 手动测试", "location": "测试地点", "eventTypeName": "飞书图文测试",
                 "level": "测试", "happenTime": datetime.now().astimezone().isoformat(timespec="seconds"),
                 "status": 0, "ruleName": "测试消息，用于确认文字和图片投递，非真实报警", "measurements": []}
        image = {"label": "系统测试图片", "mime": "image/png", "content": test_image()}
        return self.send(config, alarm, [image], "", str(uuid.uuid4()), allowed)

    def request(self, base, path, body, token=None, method="POST", content_type="application/json"):
        stage = ("获取应用令牌" if "/auth/" in path else "上传图片" if path == "/open-apis/im/v1/images"
                 else "更新卡片" if method == "PATCH" else "发送图文卡片")
        headers = {"Content-Type": content_type}
        if token:
            headers["Authorization"] = "Bearer " + token
            self.sensitive.add(token)
        if isinstance(body, dict) and body.get("app_secret"):
            self.sensitive.add(body["app_secret"])
        raw = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        try:
            response, _ = self.transport(base.rstrip("/") + path, raw, headers, method=method, error_json=True)
        except ValueError as error:
            raise ValueError(f"飞书{stage}失败：{error}") from None
        try:
            result = json.loads(response)
        except ValueError:
            raise ValueError(f"飞书{stage}失败：返回非 JSON 响应") from None
        if not isinstance(result, dict):
            raise ValueError(f"飞书{stage}失败：响应格式不正确")
        if str(result.get("code")) != "0" or result.get("_http_status", 200) >= 400:
            self.tokens.clear()
            # Show only bounded diagnostic fields, with secrets and URLs removed.
            code = str(result.get("code", "未提供"))
            if not re.fullmatch(r"[\w.-]{1,64}", code):
                code = "未提供"
            message = str(result.get("msg") or result.get("message") or "请检查应用配置、权限和接收人")
            for secret in sorted(self.sensitive, key=len, reverse=True):
                message = message.replace(secret, "***")
                message = message.replace(json.dumps(secret)[1:-1], "***")
            message = re.sub(r"https?://\S+", "[链接已省略]", message)
            message = re.sub(r"[\x00-\x1f\x7f]", " ", message)[:400]
            http = f'HTTP {result["_http_status"]}，' if "_http_status" in result else ""
            hint = {"230002": "请将应用机器人加入接收群", "230006": "请启用应用的机器人能力并发布",
                    "234007": "请启用应用的机器人能力并发布", "230013": "请检查接收用户是否在应用可用范围内",
                    "99991672": "请开通该接口所需权限并发布应用"}.get(code)
            suffix = f"；{hint}" if hint else ""
            raise ValueError(f"飞书{stage}失败（{http}错误码 {code}）：{message}{suffix}")
        return result

    def tenant_token(self, config):
        identity = hashlib.sha256((config["baseUrl"] + config["appId"] + config["appSecret"]).encode()).hexdigest()
        cached = self.tokens.get(identity)
        if cached and cached[1] > time.monotonic():
            return cached[0]
        result = self.request(config["baseUrl"], "/open-apis/auth/v3/tenant_access_token/internal",
                              {"app_id": config["appId"], "app_secret": config["appSecret"]})
        token = result.get("tenant_access_token")
        if not token:
            raise ValueError("飞书未返回租户访问令牌")
        self.tokens = {identity: (token, time.monotonic() + max(0, int(result.get("expire", 7200)) - 120))}
        return token

    def upload(self, config, token, image):
        key = hashlib.sha256((config["baseUrl"] + config["appId"]).encode() + image["content"]).hexdigest()
        if key in self.image_keys:
            return self.image_keys[key]
        boundary = "----Thermal" + secrets.token_hex(16)
        extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}[image["mime"]]
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="image_type"\r\n\r\nmessage\r\n'
                f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="alarm.{extension}"\r\n'
                f'Content-Type: {image["mime"]}\r\n\r\n').encode() + image["content"] + f'\r\n--{boundary}--\r\n'.encode()
        result = self.request(config["baseUrl"], "/open-apis/im/v1/images", body, token,
                              content_type="multipart/form-data; boundary=" + boundary)
        image_key = result.get("data", {}).get("image_key")
        if not image_key:
            raise ValueError("飞书未返回图片标识")
        if len(self.image_keys) >= 256:
            self.image_keys.clear()
        self.image_keys[key] = image_key
        return image_key

    def send(self, config, alarm, images, message_id, request_id, allowed):
        if not allowed():
            raise ValueError("推送已关闭或配置已变更")
        token = self.tenant_token(config)
        keys = []
        for image in images:
            if image["content"]:
                if not allowed():
                    raise ValueError("推送已关闭或配置已变更")
                keys.append((image["label"], self.upload(config, token, image)))
        card = make_card(alarm, keys)
        if not allowed():
            raise ValueError("推送已关闭或配置已变更")
        content = json.dumps(card, ensure_ascii=False)
        if message_id:
            self.request(config["baseUrl"], "/open-apis/im/v1/messages/" + quote(message_id, safe=""), {"content": content}, token, method="PATCH")
            return message_id
        result = self.request(config["baseUrl"], "/open-apis/im/v1/messages?" + urlencode({"receive_id_type": config["receiveIdType"]}),
                              {"receive_id": config["receiveId"], "msg_type": "interactive", "content": content, "uuid": request_id}, token)
        message_id = result.get("data", {}).get("message_id")
        if not message_id:
            raise ValueError("飞书未返回消息 ID，请核对实际投递结果")
        return message_id
