from __future__ import annotations

import json
import os
from dataclasses import asdict, is_dataclass
from enum import Enum
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import unquote, urlparse

from .contracts import Settings
from .pipeline.orchestrator import analyze_media
from .service import (
    DEFAULT_DATABASE_PATH,
    analyze_request,
    apply_review_update,
    list_session_summaries_request,
    load_session_request,
)


def _convert(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if is_dataclass(value):
        return _convert(asdict(value))
    if isinstance(value, dict):
        converted: dict[str, Any] = {}
        for key, inner in value.items():
            if key == "use_mock_data" or inner is None:
                continue
            converted[_camel_case(key)] = _convert(inner)
        return converted
    if isinstance(value, list):
        return [_convert(item) for item in value]
    return value


def _camel_case(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class AnalyzerRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        request_path = urlparse(self.path).path

        if request_path == "/health":
            self._send_json(
                200,
                {
                    "service": "analyzer",
                    "status": "ok",
                    "mode": "heuristic-local",
                },
            )
            return

        if request_path == "/session/mock":
            session = analyze_media(None, Settings(use_mock_data=True))
            self._send_json(200, _convert(session))
            return

        if request_path == "/sessions":
            database_path = str(
                os.getenv("HIGHLIGHTSMITH_ANALYZER_DATABASE_PATH") or DEFAULT_DATABASE_PATH
            )
            summaries = list_session_summaries_request(
                database_path=database_path,
            )
            self._send_json(
                200,
                {
                    "status": "listed",
                    "sessions": _convert(summaries),
                },
            )
            return

        if request_path.startswith("/session/"):
            session_id = unquote(request_path.removeprefix("/session/")).strip()
            database_path = str(
                os.getenv("HIGHLIGHTSMITH_ANALYZER_DATABASE_PATH") or DEFAULT_DATABASE_PATH
            )
            try:
                session = load_session_request(
                    session_id,
                    database_path=database_path,
                )
            except KeyError:
                self._send_json(
                    404,
                    {
                        "error": "not_found",
                        "message": f"Project session not found: {session_id}",
                    },
                )
                return
            except FileNotFoundError as error:
                self._send_json(
                    400,
                    {
                        "error": "session_unavailable",
                        "message": str(error),
                    },
                )
                return

            self._send_json(
                200,
                {
                    "status": "loaded",
                    "session": _convert(session),
                },
            )
            return

        self._send_json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        request_path = urlparse(self.path).path

        if request_path == "/analyze/mock":
            _ = self._read_json_body()
            session = analyze_media(None, Settings(use_mock_data=True))
            self._send_json(
                200,
                {
                    "status": "completed",
                    "session": _convert(session),
                },
            )
            return

        if request_path == "/analyze":
            payload = self._read_json_body()
            source_path = str(payload.get("sourcePath", "")).strip()
            if not source_path:
                self._send_json(
                    400,
                    {
                        "error": "invalid_request",
                        "message": "sourcePath is required",
                    },
                )
                return

            profile_id = str(payload.get("profileId", "generic")).strip() or "generic"
            session_title = payload.get("sessionTitle")
            session_title = str(session_title).strip() if session_title else None
            persist = bool(payload.get("persist", True))
            database_path = self._database_path_from_payload(payload)

            try:
                session = analyze_request(
                    source_path,
                    profile_id=profile_id,
                    session_title=session_title,
                    persist=persist,
                    database_path=database_path,
                    settings=Settings(),
                )
            except (FileNotFoundError, ValueError) as error:
                self._send_json(
                    400,
                    {
                        "error": "analysis_failed",
                        "message": str(error),
                    },
                )
                return
            except Exception as error:  # pragma: no cover - defensive server guard
                self._send_json(
                    500,
                    {
                        "error": "analysis_failed",
                        "message": str(error),
                    },
                )
                return

            self._send_json(
                200,
                {
                    "status": "completed",
                    "session": _convert(session),
                },
            )
            return

        if request_path == "/review":
            payload = self._read_json_body()
            session_id = str(payload.get("sessionId", "")).strip()
            candidate_id = str(payload.get("candidateId", "")).strip()
            action = str(payload.get("action", "")).strip()
            if not session_id or not candidate_id or not action:
                self._send_json(
                    400,
                    {
                        "error": "invalid_request",
                        "message": "sessionId, candidateId, and action are required",
                    },
                )
                return

            label = payload.get("label")
            label = str(label).strip() if label is not None else None
            notes = payload.get("notes")
            notes = str(notes).strip() if notes is not None else None
            timestamp = payload.get("timestamp")
            timestamp = str(timestamp).strip() if timestamp else None
            adjusted_segment_payload = payload.get("adjustedSegment")
            adjusted_segment = None
            if isinstance(adjusted_segment_payload, dict):
                adjusted_segment = {
                    "start_seconds": float(adjusted_segment_payload["startSeconds"]),
                    "end_seconds": float(adjusted_segment_payload["endSeconds"]),
                }

            try:
                session = apply_review_update(
                    session_id,
                    candidate_id,
                    action=action,
                    label=label,
                    adjusted_segment=adjusted_segment,
                    notes=notes,
                    timestamp=timestamp,
                    database_path=self._database_path_from_payload(payload),
                )
            except KeyError as error:
                self._send_json(
                    404,
                    {
                        "error": "not_found",
                        "message": str(error),
                    },
                )
                return
            except (ValueError, TypeError) as error:
                self._send_json(
                    400,
                    {
                        "error": "review_failed",
                        "message": str(error),
                    },
                )
                return
            except Exception as error:  # pragma: no cover - defensive server guard
                self._send_json(
                    500,
                    {
                        "error": "review_failed",
                        "message": str(error),
                    },
                )
                return

            self._send_json(
                200,
                {
                    "status": "updated",
                    "session": _convert(session),
                },
            )
            return

        self._send_json(404, {"error": "not_found"})

    def log_message(self, format: str, *args: object) -> None:
        return

    def _read_json_body(self) -> dict[str, Any]:
        raw_body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        if not raw_body:
            return {}
        try:
            return json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            return {}

    def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _database_path_from_payload(self, payload: dict[str, Any]) -> str:
        return str(
            payload.get("databasePath")
            or os.getenv("HIGHLIGHTSMITH_ANALYZER_DATABASE_PATH")
            or DEFAULT_DATABASE_PATH
        )


def main() -> int:
    host = os.getenv("HIGHLIGHTSMITH_ANALYZER_HOST", "127.0.0.1")
    port = int(os.getenv("HIGHLIGHTSMITH_ANALYZER_PORT", "9010"))
    server = ThreadingHTTPServer((host, port), AnalyzerRequestHandler)
    print(f"HighlightSmith analyzer listening on http://{host}:{port}")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
