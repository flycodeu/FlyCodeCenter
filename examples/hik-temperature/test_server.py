import json
import io
import sqlite3
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, urlopen

import server


class WorkbenchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.db = Path(cls.temp.name) / "events.sqlite3"
        cls.app = server.WorkbenchServer(("127.0.0.1", 0), cls.db)
        cls.worker = threading.Thread(target=cls.app.serve_forever, daemon=True)
        cls.worker.start()
        cls.base = f"http://127.0.0.1:{cls.app.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.app.shutdown()
        cls.app.server_close()
        cls.worker.join()
        cls.temp.cleanup()

    def request(self, path, body=None, headers=None):
        req = Request(self.base + path, data=server.encode(body) if body is not None else None,
                      headers=headers or {})
        try:
            with urlopen(req, timeout=3) as result:
                return result.status, result.read()
        except HTTPError as exc:
            return exc.code, exc.read()

    def test_signature_matches_independent_node_crypto_vector(self):
        with patch("server.uuid.uuid4", return_value="test-nonce"), patch("server.time.time", return_value=1700000000):
            headers = server.signed_headers("test-key", "test-secret", server.APIS["search"])
        self.assertEqual(headers["X-Ca-Signature"], "Pdoh5G2Y+RxGxcs2VtRR9reqM+qwyj0t1S2zTQkFuaw=")
        self.assertEqual(headers["X-Ca-Signature-Headers"], "x-ca-key,x-ca-nonce,x-ca-timestamp")
        self.assertNotIn("test-secret", str(headers))

    def test_page_injects_session_and_blocks_foreign_hosts(self):
        status, data = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn(self.app.token.encode(), data)
        self.assertEqual(self.request("/", headers={"Host": "evil.example"})[0], 403)
        self.assertEqual(self.request("/api/info", headers={"Origin": "https://evil.example"})[0], 403)

    def test_post_requires_local_session_token(self):
        self.assertEqual(self.request("/api/search", {})[0], 403)

    def test_internal_image_ips_bypass_environment_proxy(self):
        with patch("server.build_opener") as build:
            result = build.return_value.open.return_value.__enter__.return_value
            result.read.return_value = b"\xff\xd8\xfftest"
            result.headers.get_content_type.return_value = "image/jpeg"
            server.remote("http://172.17.8.23:6120/pic?private-ticket")
            proxies = [h for h in build.call_args.args if isinstance(h, ProxyHandler)]
            self.assertEqual(len(proxies), 1)
            self.assertEqual(proxies[0].proxies, {})
            server.remote("https://open.feishu.cn/open-apis/test")
            self.assertFalse(any(isinstance(h, ProxyHandler) for h in build.call_args.args))

    def test_image_redirect_downloads_bytes_without_forwarding_credentials(self):
        observed = []
        class ImageHandler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                if self.path == "/start":
                    self.send_response(301)
                    self.send_header("Location", f"http://127.0.0.1:{target.server_port}/photo")
                    self.end_headers()
                elif self.path == "/loop":
                    self.send_response(302)
                    self.send_header("Location", "/loop")
                    self.end_headers()
                else:
                    observed.append(dict(self.headers))
                    self.send_response(200)
                    self.send_header("Content-Type", "image/jpeg")
                    self.end_headers()
                    self.wfile.write(b"\xff\xd8\xfftest-image")
        source = ThreadingHTTPServer(("127.0.0.1", 0), ImageHandler)
        target = ThreadingHTTPServer(("127.0.0.1", 0), ImageHandler)
        for app in (source, target):
            threading.Thread(target=app.serve_forever, daemon=True).start()
        try:
            url = f"http://127.0.0.1:{source.server_port}/start"
            data, mime = server.remote(url, headers={"Authorization": "Bearer private-token", "X-Ca-Key": "private-key", "Cookie": "private-cookie"}, follow_redirects=True)
            self.assertEqual(data, b"\xff\xd8\xfftest-image")
            self.assertEqual(mime, "image/jpeg")
            for name in ("Authorization", "X-Ca-Key", "Cookie"):
                self.assertNotIn(name, observed[0])
            with self.assertRaisesRegex(ValueError, "HTTP 301"):
                server.remote(url)
            with self.assertRaisesRegex(ValueError, "HTTP 302"):
                server.remote(f"http://127.0.0.1:{source.server_port}/loop", follow_redirects=True)
        finally:
            for app in (source, target):
                app.shutdown()
                app.server_close()

    def test_image_redirect_rejects_post_and_https_downgrade(self):
        with self.assertRaises(ValueError):
            server.remote("https://example.test", body=b"credentials", follow_redirects=True)
        with self.assertRaises(ValueError):
            server.ImageRedirect().redirect_request(Request("https://example.test/photo"), None, 301, "", {}, "http://example.test/photo")

    def test_feishu_test_sends_saved_credentials_image_and_text_while_disabled(self):
        self.app.store.save({"feishu": {"enabled": False, "appId": "cli_mock", "appSecret": "mock-private-secret", "receiveId": "oc_mock"}})
        calls = []
        def transport(url, body=None, headers=None, **kwargs):
            calls.append((url, body, headers))
            if url.endswith("/internal"):
                self.assertEqual(json.loads(body)["app_secret"], "mock-private-secret")
                response = {"code": 0, "tenant_access_token": "mock-token", "expire": 7200}
            elif url.endswith("/images"):
                self.assertIn(b"\x89PNG\r\n\x1a\n", body)
                self.assertIn(b'name="image_type"', body)
                response = {"code": 0, "data": {"image_key": "mock-test-image"}}
            else:
                message = json.loads(body)
                self.assertEqual(message["receive_id"], "oc_mock")
                card = json.loads(message["content"])
                self.assertIn("测试", card["header"]["title"]["content"])
                self.assertIn("非真实报警", card["elements"][0]["text"]["content"])
                self.assertEqual(card["elements"][1]["img_key"], "mock-test-image")
                response = {"code": 0, "data": {"message_id": "om_test"}}
            return server.encode(response), "application/json"
        before = len(self.app.store.list_alarms())
        with patch("server.remote", side_effect=transport):
            self.assertEqual(self.request("/api/feishu-test", {})[0], 403)
            self.assertEqual(calls, [])
            status, raw = self.request("/api/feishu-test", {}, {"X-Workbench-Token": self.app.token})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["messageId"], "om_test")
        self.assertEqual(len(calls), 3)
        self.assertNotIn(b"mock-private-secret", raw)
        self.assertFalse(self.app.store.settings()["feishu"]["enabled"])
        self.assertEqual(before, len(self.app.store.list_alarms()))

    def test_feishu_test_rejects_overrides_and_concurrent_sends(self):
        headers = {"X-Workbench-Token": self.app.token}
        with patch("server.remote") as remote:
            self.assertEqual(self.request("/api/feishu-test", {"receiveId": "oc_other"}, headers)[0], 400)
            self.app.test_push_lock.acquire()
            try:
                self.assertEqual(self.request("/api/feishu-test", {}, headers)[0], 400)
            finally:
                self.app.test_push_lock.release()
            remote.assert_not_called()

    def test_feishu_test_reports_failure_and_releases_lock(self):
        headers = {"X-Workbench-Token": self.app.token}
        self.app.store.save({"feishu": {"appId": "cli_mock", "appSecret": "mock-private-secret", "receiveId": "oc_mock"}})
        with patch("server.remote", return_value=(b'{"code":99991672}', "application/json")):
            status, raw = self.request("/api/feishu-test", {}, headers)
        self.assertEqual(status, 400)
        self.assertIn(b"99991672", raw)
        self.assertFalse(self.app.test_push_lock.locked())

    def test_feishu_http_400_shows_stage_code_and_redacts_token(self):
        error = HTTPError("https://open.feishu.cn/open-apis/im/v1/images", 400, "Bad Request", {},
                          io.BytesIO(server.encode({"code": 234007, "msg": "App does not enable bot feature. token=private-token"})))
        with patch("server.build_opener") as build:
            build.return_value.open.side_effect = error
            with self.assertRaises(ValueError) as caught:
                server.Feishu(server.remote).request("https://open.feishu.cn", "/open-apis/im/v1/images", b"test", "private-token")
        message = str(caught.exception)
        self.assertIn("上传图片", message)
        self.assertIn("HTTP 400", message)
        self.assertIn("234007", message)
        self.assertIn("机器人能力", message)
        self.assertNotIn("private-token", message)

    def test_feishu_auth_error_redacts_secret_and_does_not_leak_url(self):
        error = HTTPError("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", 400, "Bad Request", {},
                          io.BytesIO(server.encode({"code": 10003, "msg": "Invalid app_secret private-secret see https://internal.example/?secret=hidden"})))
        with patch("server.build_opener") as build:
            build.return_value.open.side_effect = error
            with self.assertRaises(ValueError) as caught:
                server.Feishu(server.remote).tenant_token({"baseUrl": "https://open.feishu.cn", "appId": "cli_mock", "appSecret": "private-secret"})
        message = str(caught.exception)
        self.assertIn("获取应用令牌", message)
        self.assertIn("10003", message)
        self.assertNotIn("private-secret", message)
        self.assertNotIn("internal.example", message)

    def test_feishu_non_json_http_400_still_identifies_stage(self):
        error = HTTPError("https://open.feishu.cn/open-apis/im/v1/images", 400, "Bad Request", {}, io.BytesIO(b"<html>private-proxy-error</html>"))
        with patch("server.build_opener") as build:
            build.return_value.open.side_effect = error
            with self.assertRaises(ValueError) as caught:
                server.Feishu(server.remote).request("https://open.feishu.cn", "/open-apis/im/v1/images", b"test", "private-token")
        self.assertIn("上传图片", str(caught.exception))
        self.assertIn("HTTP 400", str(caught.exception))
        self.assertNotIn("private-proxy-error", str(caught.exception))

    def test_saved_secret_routes_are_protected_and_reusable(self):
        config = {"hik": {"platform": "https://stored.example", "appKey": "saved-key", "appSecret": "saved-private-value"}}
        self.assertEqual(self.request("/api/settings", config)[0], 403)
        status, raw = self.request("/api/settings", config, {"X-Workbench-Token": self.app.token})
        self.assertEqual(status, 200)
        self.assertNotIn(b"saved-private-value", raw)
        self.assertTrue(json.loads(raw)["hik"]["secretSaved"])
        payload = {"platform": "https://stored.example", "appKey": "saved-key", "useSavedSecret": True, "body": {}}
        with patch("server.remote", return_value=(b'{"code":"0","data":{"list":[]}}', "application/json")) as mocked:
            self.assertEqual(self.request("/api/search", payload, {"X-Workbench-Token": self.app.token})[0], 200)
            self.assertIn("X-Ca-Signature", mocked.call_args.args[2])
            payload["platform"] = "https://unrelated.example"
            self.assertEqual(self.request("/api/search", payload, {"X-Workbench-Token": self.app.token})[0], 400)

    def test_callback_is_persisted_and_path_survives_restart(self):
        for status in (1, 2, 5):
            message = {"method": "OnEventNotify", "params": {"events": [{
                "eventId": "same-event", "eventType": 192517, "status": status,
                "srcIndex": "demo-camera", "happenTime": "2026-10-21T15:00:00+08:00"
            }]}}
            self.assertEqual(self.request(self.app.callback_path, message)[0], 200)
        with closing(sqlite3.connect(self.db)) as db, db:
            saved = [json.loads(r[0])["params"]["events"][0] for r in db.execute("SELECT payload FROM messages")]
        self.assertEqual([e["status"] for e in saved], [1, 2, 5])
        second = server.WorkbenchServer(("127.0.0.1", 0), self.db)
        try:
            self.assertEqual(second.callback_path, self.app.callback_path)
        finally:
            second.server_close()
        status, data = self.request("/api/events")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data)["total"], 3)

    def test_callback_rejects_invalid_envelope_and_browser_posts(self):
        self.assertEqual(self.request(self.app.callback_path, {"hello": "world"})[0], 400)
        good = {"method": "OnEventNotify", "params": {"events": [{}]}}
        self.assertEqual(self.request(self.app.callback_path, good, {"Origin": "http://evil.example"})[0], 403)

    def test_gateway_signs_and_preserves_query_without_saving_secrets(self):
        payload = {"platform": "https://hik.example:442", "appKey": "example-key", "appSecret": "example-secret",
                   "body": {"name": "垃圾房", "pageNo": 2, "pageSize": 20}}
        response = {"code": "0", "data": {"total": 21, "list": [{"indexCode": "camera-21"}]}}
        with patch("server.remote", return_value=(server.encode(response), "application/json")) as mocked:
            status, data = self.request("/api/search", payload, {"X-Workbench-Token": self.app.token})
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(data), response)
            args = mocked.call_args.args
            self.assertEqual(args[0], "https://hik.example:442/artemis/api/resource/v2/camera/search")
            self.assertEqual(json.loads(args[1]), payload["body"])
            self.assertIn("X-Ca-Signature", args[2])
            self.assertNotIn("example-secret", str(args))
        self.assertNotIn(b"example-secret", self.db.read_bytes())

    def test_subscription_rejects_loopback_destination(self):
        payload = {"platform": "https://hik.example:442", "appKey": "key", "appSecret": "secret",
                   "body": {"eventTypes": [192517], "eventDest": "http://127.0.0.1:8769/callback/test", "subType": 0}}
        with patch("server.remote") as mocked:
            status, _ = self.request("/api/subscribe", payload, {"X-Workbench-Token": self.app.token})
            self.assertEqual(status, 400)
            mocked.assert_not_called()

    def test_unsubscribe_requires_confirmation_and_only_temperature_types(self):
        payload = {"platform": "https://hik.example:442", "appKey": "key", "appSecret": "secret",
                   "body": {"eventTypes": [192517]}}
        with patch("server.remote") as mocked:
            self.assertEqual(self.request("/api/unsubscribe", payload, {"X-Workbench-Token": self.app.token})[0], 400)
            payload.update(confirmed=True, subscriptionRevision="example")
            payload["body"] = {"eventTypes": [771760134]}
            self.assertEqual(self.request("/api/unsubscribe", payload, {"X-Workbench-Token": self.app.token})[0], 400)
            mocked.assert_not_called()

    def test_unsubscribe_preflight_preserves_other_event_types(self):
        listing = {"code": "0", "data": {"detail": [
            {"eventDest": "http://receiver-a/event", "eventTypes": [192517, 192518]},
            {"eventDest": "http://receiver-b/event", "eventTypes": [192517]},
            {"eventDest": "http://parking/event", "eventTypes": [771760134]}]}}
        payload = {"platform": "https://hik.example:442", "appKey": "key", "appSecret": "secret",
                   "body": {"eventTypes": [192517]}, "confirmed": True,
                   "subscriptionRevision": server.subscription_revision(listing)}
        with patch("server.remote", side_effect=[(server.encode(listing), "application/json"),
                                                (b'{"code":"0"}', "application/json")]) as mocked:
            status, data = self.request("/api/unsubscribe", payload, {"X-Workbench-Token": self.app.token})
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(data)["code"], "0")
            self.assertTrue(mocked.call_args_list[0].args[0].endswith(server.APIS["subscriptions"]))
            self.assertTrue(mocked.call_args_list[1].args[0].endswith(server.APIS["unsubscribe"]))
            self.assertEqual(json.loads(mocked.call_args_list[1].args[1]), {"eventTypes": [192517]})

    def test_changed_subscription_list_blocks_cancel(self):
        before = {"code": "0", "data": {"detail": [{"eventDest": "http://a/event", "eventTypes": [192517]}]}}
        after = {"code": "0", "data": {"detail": before["data"]["detail"] + [{"eventDest": "http://new/event", "eventTypes": [192517]}]}}
        payload = {"platform": "https://hik.example:442", "appKey": "key", "appSecret": "secret",
                   "body": {"eventTypes": [192517]}, "confirmed": True,
                   "subscriptionRevision": server.subscription_revision(before)}
        with patch("server.remote", return_value=(server.encode(after), "application/json")) as mocked:
            self.assertEqual(self.request("/api/unsubscribe", payload, {"X-Workbench-Token": self.app.token})[0], 400)
            self.assertEqual(mocked.call_count, 1)

    def test_subscription_revision_is_order_independent(self):
        a = {"code": "0", "data": {"detail": [{"eventDest": "b", "eventTypes": [192518,192517]}, {"eventDest": "a", "eventTypes": [192517]}]}}
        b = {"code": "0", "data": {"detail": [{"eventDest": "a", "eventTypes": [192517]}, {"eventDest": "b", "eventTypes": [192517,192518]}]}}
        self.assertEqual(server.subscription_revision(a), server.subscription_revision(b))


class RemoteAdminTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.secret = "random-management-token-for-test-only"
        self.origin = "http://10.20.0.40:8769"
        self.app = server.WorkbenchServer(("127.0.0.1", 0), Path(self.temp.name) / "events.sqlite3",
                                          public_url=self.origin, admin_token=self.secret)
        self.worker = threading.Thread(target=self.app.serve_forever, daemon=True)
        self.worker.start()
        self.base = f"http://127.0.0.1:{self.app.server_port}"

    def tearDown(self):
        self.app.shutdown(); self.app.server_close(); self.worker.join(); self.temp.cleanup()

    def request(self, path, body=None, extra=None):
        headers = {"Host": "10.20.0.40:8769", **(extra or {})}
        req = Request(self.base + path, data=server.encode(body) if body is not None else None, headers=headers)
        try:
            response = urlopen(req, timeout=3)
        except HTTPError as exc:
            response = exc
        with response:
            return response.status, response.read(), response.headers

    def login(self):
        status, _, headers = self.request("/api/login", {"token": self.secret}, {"Origin": self.origin})
        self.assertEqual(status, 200)
        return headers["Set-Cookie"].split(";", 1)[0]

    def test_remote_access_login_logout_and_public_callback(self):
        status, page, _ = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn("管理口令".encode(), page)
        self.assertNotIn(self.app.token.encode(), page)
        self.assertEqual(self.request("/api/events")[0], 401)
        self.assertEqual(self.request("/workbench.js")[0], 401)
        cookie = self.login()
        status, page, _ = self.request("/", extra={"Cookie": cookie})
        self.assertEqual(status, 200)
        self.assertIn(self.app.token.encode(), page)
        self.assertNotIn(self.secret.encode(), page)
        status, data, _ = self.request("/api/info", extra={"Cookie": cookie})
        self.assertEqual(json.loads(data)["callbackUrl"], self.origin + self.app.callback_path)
        self.assertEqual(self.request("/api/logout", {}, {"Cookie": cookie, "Origin": self.origin, "X-Workbench-Token": self.app.token})[0], 200)
        self.assertEqual(self.request("/api/events", extra={"Cookie": cookie})[0], 401)

    def test_remote_login_rejects_bad_origin_token_and_expired_session(self):
        self.assertEqual(self.request("/api/login", {"token": self.secret}, {"Origin": "http://evil.example"})[0], 403)
        self.assertEqual(self.request("/api/login", {"token": "wrong"}, {"Origin": self.origin})[0], 401)
        cookie = self.login()
        self.assertEqual(self.request("/api/events", extra={"Cookie": cookie, "Origin": "http://evil.example"})[0], 403)
        with self.app.auth_lock:
            self.app.sessions = {k: 0 for k in self.app.sessions}
        self.assertEqual(self.request("/api/events", extra={"Cookie": cookie})[0], 401)

    def test_callback_without_login_but_admin_post_requires_session_and_csrf(self):
        good = {"method":"OnEventNotify", "params":{"events":[{"eventType":192517}]}}
        self.assertEqual(self.request(self.app.callback_path, good)[0], 200)
        self.assertEqual(self.request("/api/subscribe", {})[0], 401)
        cookie = self.login()
        self.assertEqual(self.request("/api/subscribe", {}, {"Cookie": cookie, "Origin": self.origin})[0], 403)

    def test_login_rate_limit_and_proxy_cannot_bypass_login(self):
        for _ in range(5):
            self.assertEqual(self.request("/api/login", {"token":"wrong"}, {"Origin":self.origin})[0], 401)
        self.assertEqual(self.request("/api/login", {"token":self.secret}, {"Origin":self.origin})[0], 429)
        status, _, _ = self.request("/api/events", extra={"Host": f"127.0.0.1:{self.app.server_port}", "X-Forwarded-For":"172.16.226.43"})
        self.assertEqual(status, 403)


if __name__ == "__main__":
    unittest.main()
