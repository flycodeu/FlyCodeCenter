"""Python 3.11+ / standard library only. ZLM controls media; FFmpeg decodes it."""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time
import urllib.parse
import urllib.request
import uuid


class Zlm:
    def __init__(self) -> None:
        self.base = os.environ.get("ZLM_API", "http://127.0.0.1:8088").rstrip("/")
        self.secret = os.environ["ZLM_SECRET"]
        parsed = urllib.parse.urlsplit(self.base)
        if parsed.scheme not in {"http", "https"} or parsed.username or parsed.query or parsed.fragment:
            raise ValueError("ZLM_API must be an HTTP(S) origin without credentials")
        self.http = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def call(self, method: str, **fields: object) -> dict:
        data = urllib.parse.urlencode({"secret": self.secret, **fields}).encode()
        request = urllib.request.Request(f"{self.base}/index/api/{method}", data=data)
        with self.http.open(request, timeout=12) as response:
            body = response.read(2_000_001)
        if len(body) > 2_000_000:
            raise ValueError("API response too large")
        result = json.loads(body)
        if result.get("code") != 0:
            # Server messages can contain source URLs or tokens; keep them out of teaching logs.
            raise RuntimeError(f"{method} failed, code={result.get('code')}")
        return result

    def media(self, app: str, stream: str) -> list[dict]:
        return self.call("getMediaList", vhost="__defaultVhost__", app=app, stream=stream).get("data") or []

    def wait(self, app: str, stream: str, seconds: int = 25) -> list[dict]:
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            rows = self.media(app, stream)
            if any(row.get("schema") == "rtsp" and row.get("tracks") for row in rows):
                return rows
            time.sleep(0.25)
        raise TimeoutError("No registered RTSP video track within the deadline")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Management API redirects are not allowed")


def parse_source(value: str) -> dict:
    uri = urllib.parse.urlsplit(value)
    defaults = {"rtsp": 554, "rtmp": 1935, "http": 80, "https": 443}
    if uri.scheme not in defaults or not uri.hostname or uri.fragment:
        raise ValueError("Expected an RTSP, RTMP or HTTP(S) source")
    # URL syntax parsing does not connect to the camera or decode any media.
    return {"scheme": uri.scheme, "host": uri.hostname, "port": uri.port or defaults[uri.scheme],
            "has_credentials": bool(uri.username), "has_query": bool(uri.query)}


def binary(name: str) -> str:
    return os.environ.get(name.upper(), name)


def inspect(source: str) -> dict:
    options = ["-rtsp_transport", "tcp"] if source.startswith("rtsp://") else []
    result = subprocess.run([binary("ffprobe"), "-v", "error", *options, "-i", source,
                             "-show_entries", "stream=index,codec_type,codec_name,width,height,r_frame_rate",
                             "-of", "json"], capture_output=True, timeout=20)
    if result.returncode:
        raise RuntimeError("ffprobe failed; check source, authentication and network")
    return json.loads(result.stdout)


def frame(source: str, destination: str) -> dict:
    options = ["-rtsp_transport", "tcp"] if source.startswith("rtsp://") else []
    result = subprocess.run([binary("ffmpeg"), "-v", "error", *options, "-i", source,
                             "-an", "-vf", "scale=640:360", "-frames:v", "1", "-pix_fmt", "rgb24",
                             "-f", "rawvideo", "pipe:1"], capture_output=True, timeout=25)
    if result.returncode or len(result.stdout) != 640 * 360 * 3:
        raise RuntimeError("FFmpeg did not decode one complete RGB frame")
    with open(destination, "xb") as output:
        output.write(b"P6\n640 360\n255\n" + result.stdout)
    return {"width": 640, "height": 360, "rgb_bytes": len(result.stdout), "file": destination}


def urls(zlm: Zlm, app: str, stream: str) -> dict:
    host = urllib.parse.urlsplit(zlm.base).hostname
    host = f"[{host}]" if ":" in host else host
    port = int(os.environ.get("ZLM_RTSP_PORT", "8554"))
    return {"rtsp": f"rtsp://{host}:{port}/{app}/{stream}",
            "http_flv": f"{zlm.base}/{app}/{stream}.live.flv",
            "hls": f"{zlm.base}/{app}/{stream}/hls.m3u8",
            "browser": f"{zlm.base}/webrtc/?app={app}&stream={stream}&type=play"}


def pull(zlm: Zlm, source: str, stream: str, seconds: int, output: str | None) -> None:
    parse_source(source)
    app = "tutorial"
    if zlm.media(app, stream):
        raise ValueError("Target stream already exists; choose another stream ID")
    result = zlm.call("addStreamProxy", vhost="__defaultVhost__", app=app, stream=stream,
                      url=source, rtp_type=0, retry_count=0, timeout_sec=10,
                      enable_rtsp=1, enable_rtmp=1, enable_hls=1, enable_mp4=0)
    key = result["data"]["key"]
    try:
        rows = zlm.wait(app, stream)
        addresses = urls(zlm, app, stream)
        print(json.dumps({"play": addresses, "tracks": rows[0].get("tracks", [])}), flush=True)
        if output:
            print(json.dumps(frame(addresses["rtsp"], output)), flush=True)
        time.sleep(seconds)
    finally:
        zlm.call("delStreamProxy", key=key)


def gb_media(zlm: Zlm, source_app: str, source_stream: str, seconds: int) -> None:
    """Simulate the PS/RTP media leg. SIP registration/session control is a separate layer."""
    stream = "gb_" + uuid.uuid4().hex[:12]
    ssrc = str(100000000 + uuid.uuid4().int % 899999999)
    receiver = zlm.call("openRtpServer", port=0, tcp_mode=0, stream_id=stream)
    try:
        zlm.call("startSendRtp", vhost="__defaultVhost__", app=source_app, stream=source_stream,
                 ssrc=ssrc, dst_url="127.0.0.1", dst_port=receiver["port"], is_udp=1, use_ps=1, pt=96)
        try:
            zlm.wait("rtp", stream)
            print(json.dumps({"play": urls(zlm, "rtp", stream), "ssrc": ssrc,
                              "rtp_port": receiver["port"], "sip_simulated": False}), flush=True)
            time.sleep(seconds)
        finally:
            zlm.call("stopSendRtp", vhost="__defaultVhost__", app=source_app, stream=source_stream, ssrc=ssrc)
    finally:
        zlm.call("closeRtpServer", stream_id=stream)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["parse", "inspect", "frame", "pull", "list", "gb-media"])
    parser.add_argument("--url", default=os.environ.get("SOURCE_URL"))
    parser.add_argument("--stream", default="camera")
    parser.add_argument("--app", default="sim")
    parser.add_argument("--seconds", type=int, default=180)
    parser.add_argument("--output")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", args.stream) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", args.app):
        parser.error("app/stream must use letters, digits, underscore or hyphen")
    if not 0 <= args.seconds <= 3600:
        parser.error("seconds must be between 0 and 3600")
    if args.action in {"parse", "inspect", "frame", "pull"} and not args.url:
        parser.error("Set SOURCE_URL or pass --url")
    if args.action == "parse":
        print(json.dumps(parse_source(args.url)))
    elif args.action == "inspect":
        print(json.dumps(inspect(args.url)))
    elif args.action == "frame":
        print(json.dumps(frame(args.url, args.output or "frame.ppm")))
    elif args.action == "pull":
        pull(Zlm(), args.url, args.stream, args.seconds, args.output)
    elif args.action == "list":
        rows = Zlm().media(args.app, args.stream)
        print(json.dumps([{"schema": r.get("schema"), "app": r.get("app"), "stream": r.get("stream"),
                           "tracks": r.get("tracks", [])} for r in rows]))
    else:
        gb_media(Zlm(), args.app, args.stream, args.seconds)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except RuntimeError as exc:
        raise SystemExit(str(exc)) from None
    except Exception as exc:
        raise SystemExit(f"{type(exc).__name__}: operation failed; check configuration and source") from None
