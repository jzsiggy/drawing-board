# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=10", "numpy>=1.26"]
# ///
"""Local stand-in for the frame API, for testing the firmware on your network.

Serves the newest .jpg/.png in images/ following app/docs/frame-protocol.md.
Drop a new image in images/ and the frame picks it up on its next check.

Usage: uv run server.py [--port 8787] [--token dev-token] [--interval 60]
"""

import argparse
import hashlib
import importlib.util
import json
import socket
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
IMAGES = HERE / "images"
CONVERT = HERE.parents[2] / "examples" / "image-dither" / "convert.py"
EXTENSIONS = {".jpg", ".jpeg", ".png"}

MAGIC = b"EPD1"
FORMAT_VERSION = 1
PANEL_13IN3_SPECTRA6 = 1


def load_convert():
    spec = importlib.util.spec_from_file_location("convert", CONVERT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


convert = load_convert()


def build_frame(image: Path) -> bytes:
    img = convert.fit_cover(convert.load(image))
    payload = convert.pack_pixels(convert.dither_floyd_steinberg(img, convert.PALETTE_IDEAL))
    header = struct.pack("<4sBBHHHI", MAGIC, FORMAT_VERSION, PANEL_13IN3_SPECTRA6, 0,
                         convert.WIDTH, convert.HEIGHT, len(payload))
    return header + payload


class Frames:
    """Converts the newest image once and keeps every frame built so far."""

    def __init__(self):
        self.lock = threading.Lock()
        self.source_key = None
        self.current_sha = None
        self.by_sha: dict[str, bytes] = {}

    def current(self) -> str | None:
        images = [p for p in IMAGES.iterdir() if p.suffix.lower() in EXTENSIONS]
        if not images:
            return None
        newest = max(images, key=lambda p: p.stat().st_mtime)
        key = (newest.name, newest.stat().st_mtime)
        with self.lock:
            if key != self.source_key:
                log(f"Converting {newest.name}...")
                data = build_frame(newest)
                sha = hashlib.sha256(data).hexdigest()
                self.by_sha[sha] = data
                self.source_key, self.current_sha = key, sha
                log(f"Ready: {newest.name} -> {sha[:12]} ({len(data)} bytes)")
            return self.current_sha


def log(message: str) -> None:
    print(time.strftime("%H:%M:%S"), message, flush=True)


def make_handler(frames: Frames, token: str, interval: int):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def authorized(self) -> bool:
            if self.headers.get("Authorization") == f"Bearer {token}":
                return True
            log(f"401 {self.path}")
            self.send_response(401)
            self.end_headers()
            return False

        def telemetry(self) -> str:
            h = self.headers
            return (f"battery {h.get('X-Battery-mV', '?')} mV, rssi {h.get('X-RSSI', '?')} dBm, "
                    f"fw {h.get('X-Firmware', '?')}")

        def do_GET(self):
            if self.path == "/api/frame/state":
                self.state()
            elif self.path.startswith("/frames/") and self.path.endswith(".bin"):
                self.frame_file(self.path[len("/frames/"):-len(".bin")])
            else:
                self.send_error(404)

        def do_POST(self):
            if self.path != "/api/frame/ack" or not self.authorized():
                return
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            sha = json.loads(body or b"{}").get("sha256", "")
            log(f"ACK   now showing {sha[:12]} ({self.telemetry()})")
            self.send_response(204)
            self.end_headers()

        def state(self):
            if not self.authorized():
                return
            sha = frames.current()
            shown = self.headers.get("If-None-Match", "").strip('"')
            if sha is None or sha == shown:
                log(f"CHECK no change, showing {shown[:12] or 'nothing'} ({self.telemetry()})")
                self.send_response(304)
                self.send_header("X-Next-Check", str(interval))
                self.end_headers()
                return
            body = json.dumps({
                "sha256": sha,
                "url": f"http://{self.headers['Host']}/frames/{sha}.bin",
                "bytes": len(frames.by_sha[sha]),
            }).encode()
            log(f"CHECK new image {sha[:12]} ({self.telemetry()})")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Next-Check", str(interval))
            self.end_headers()
            self.wfile.write(body)

        def frame_file(self, sha: str):
            data = frames.by_sha.get(sha)
            if data is None:
                self.send_error(404)
                return
            log(f"DOWNLOAD {sha[:12]}")
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    return Handler


def lan_ip() -> str:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("192.0.2.1", 80))  # no packets are sent
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--token", default="dev-token", help="must match BOARD_TOKEN in config.h")
    parser.add_argument("--interval", type=int, default=60,
                        help="X-Next-Check seconds sent to the frame (real server: 600)")
    args = parser.parse_args()

    frames = Frames()
    frames.current()  # convert up front so the first check is quick
    server = ThreadingHTTPServer(("0.0.0.0", args.port), make_handler(frames, args.token, args.interval))
    log(f"Serving on http://{lan_ip()}:{args.port}  (SERVER_BASE_URL in config.h)")
    log(f"Images from {IMAGES}, frame checks every {args.interval} s")
    server.serve_forever()


if __name__ == "__main__":
    main()
