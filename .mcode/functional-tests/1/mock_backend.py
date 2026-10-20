"""
Minimal mock implementation of the out-of-scope `/api` backend described in
the modernization spec: `POST/GET/DELETE /api/calculations` with operation
codes `add`/`sub`/`mul`/`div`, resolving to the `CalculationResponse` shape
`{id, operation, a, b, result, created_at}`, and error bodies shaped
`{"detail": "..."}`.

This stands in for the real backend (not present in this sandbox) so that
`src/api/calculatorApi.ts` can be exercised with *real* HTTP requests/responses
(through the actual Vite dev-server proxy) instead of a mocked `fetch`.

Runs on plain `http.server` (stdlib only - no Flask/FastAPI available in this
sandbox). Started/stopped per-test-module by a pytest fixture; state is
in-memory and reset via `reset()`/the `/__reset__` endpoint so tests stay
independent and idempotent.
"""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

_OPS = {
    "add": lambda a, b: a + b,
    "sub": lambda a, b: a - b,
    "mul": lambda a, b: a * b,
    "div": lambda a, b: a / b,
}


class _State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.records: list[dict] = []
        self.next_id = 1

    def reset(self) -> None:
        with self.lock:
            self.records = []
            self.next_id = 1


STATE = _State()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # noqa: A003 - silence default logging
        pass

    def _send_json(self, status: int, payload) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_no_body(self, status: int) -> None:
        self.send_response(status)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _send_error_detail(self, status: int, detail: str) -> None:
        self._send_json(status, {"detail": detail})

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return "__invalid_json__"

    def do_POST(self):  # noqa: N802 - required by BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        if parsed.path == "/__reset__":
            STATE.reset()
            self._send_no_body(204)
            return

        if parsed.path != "/calculations":
            self._send_error_detail(404, "Not found")
            return

        body = self._read_json_body()
        if body == "__invalid_json__":
            self._send_error_detail(400, "Malformed JSON body")
            return
        if not isinstance(body, dict):
            self._send_error_detail(400, "Request body must be a JSON object")
            return

        operation = body.get("operation")
        a = body.get("a")
        b = body.get("b")

        # Test-only hooks exercising calculatorApi.ts's ApiError fallback
        # path against a *real* non-JSON / detail-less error response body
        # (not achievable by hitting a normal 'operation' value).
        if operation == "__raw_fail__":
            raw = b"Internal Server Error (plain text, not JSON)"
            self.send_response(500)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if operation == "__nojson_detail__":
            self._send_json(500, {"error": "oops", "no_detail_field": True})
            return

        if operation not in _OPS:
            self._send_error_detail(400, f"Unsupported operation: {operation!r}")
            return
        if not isinstance(a, (int, float)) or isinstance(a, bool) or not isinstance(b, (int, float)) or isinstance(b, bool):
            self._send_error_detail(400, "Fields 'a' and 'b' must be numbers")
            return
        if operation == "div" and b == 0:
            self._send_error_detail(400, "Division by zero is not allowed")
            return

        result = _OPS[operation](a, b)
        with STATE.lock:
            record = {
                "id": STATE.next_id,
                "operation": operation,
                "a": a,
                "b": b,
                "result": result,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            STATE.next_id += 1
            STATE.records.append(record)

        self._send_json(201, record)

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/calculations":
            self._send_error_detail(404, "Not found")
            return
        with STATE.lock:
            records = list(STATE.records)
        self._send_json(200, records)

    def do_DELETE(self):  # noqa: N802
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        if len(parts) != 2 or parts[0] != "calculations":
            self._send_error_detail(404, "Not found")
            return
        try:
            calc_id = int(parts[1])
        except ValueError:
            self._send_error_detail(400, "Invalid id")
            return

        # Sentinel ids exercising ApiError's fallback path (no usable
        # `detail` field) over a *real* HTTP response, reachable through the
        # public `deleteCalculation(id)` API (it forwards any numeric id
        # verbatim into the URL, so these never collide with real records).
        if calc_id == 999999001:
            raw = b"Internal Server Error (plain text, not JSON)"
            self.send_response(500)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if calc_id == 999999002:
            self._send_json(500, {"error": "oops", "no_detail_field": True})
            return

        with STATE.lock:
            before = len(STATE.records)
            STATE.records = [r for r in STATE.records if r["id"] != calc_id]
            found = len(STATE.records) != before

        if not found:
            self._send_error_detail(404, f"Calculation {calc_id} not found")
            return
        self._send_no_body(204)


class MockBackend:
    """Context-manager wrapper around the threaded HTTP server."""

    def __init__(self, port: int = 8000):
        self.port = port
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        STATE.reset()
        self._server = ThreadingHTTPServer(("127.0.0.1", self.port), Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

    def reset(self) -> None:
        STATE.reset()

    def stop(self) -> None:
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
        if self._thread is not None:
            self._thread.join(timeout=5)
