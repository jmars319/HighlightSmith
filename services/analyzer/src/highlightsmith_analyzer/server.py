from __future__ import annotations

import json
import os
from dataclasses import asdict, is_dataclass
from enum import Enum
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .contracts import Settings
from .pipeline.orchestrator import analyze_media


def _convert(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if is_dataclass(value):
        return {key: _convert(inner) for key, inner in asdict(value).items()}
    if isinstance(value, dict):
        return {key: _convert(inner) for key, inner in value.items()}
    if isinstance(value, list):
        return [_convert(item) for item in value]
    return value


class AnalyzerRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send_json(
                200,
                {
                    "service": "analyzer",
                    "status": "ok",
                    "mode": "mock-placeholder",
                },
            )
            return

        if self.path == "/session/mock":
            session = analyze_media(None, Settings(use_mock_data=True))
            self._send_json(200, _convert(session))
            return

        self._send_json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/analyze/mock":
            self._send_json(404, {"error": "not_found"})
            return

        _ = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        session = analyze_media(None, Settings(use_mock_data=True))
        self._send_json(
            200,
            {
                "status": "completed",
                "session": _convert(session),
            },
        )

    def log_message(self, format: str, *args: object) -> None:
        return

    def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> int:
    host = os.getenv("HIGHLIGHTSMITH_ANALYZER_HOST", "127.0.0.1")
    port = int(os.getenv("HIGHLIGHTSMITH_ANALYZER_PORT", "9010"))
    server = ThreadingHTTPServer((host, port), AnalyzerRequestHandler)
    print(f"HighlightSmith analyzer listening on http://{host}:{port}")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
