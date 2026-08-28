from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import argparse

ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = ROOT / "frontend"
DATA_FILE = ROOT / "data" / "sync-data.json"


class WealthHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/api/data":
            self.send_json(self.read_data())
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/data":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload.get("data"), dict):
                raise ValueError("invalid data")
            DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
            DATA_FILE.write_text(json.dumps(payload), encoding="utf-8")
            self.send_json(payload)
        except (ValueError, json.JSONDecodeError):
            self.send_error(400, "Invalid sync data")

    def read_data(self):
        if not DATA_FILE.exists():
            return {"data": None, "updatedAt": None}
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {"data": None, "updatedAt": None}

    def send_json(self, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the My Wealth LAN sync server")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    print(f"My Wealth sync server: http://0.0.0.0:{args.port}")
    ThreadingHTTPServer(("0.0.0.0", args.port), WealthHandler).serve_forever()
