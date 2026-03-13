from __future__ import annotations

import argparse
import json
from dataclasses import asdict, is_dataclass
from enum import Enum
from typing import Any

from .contracts import Settings
from .pipeline.orchestrator import analyze_media
from .storage.session_store import SessionStore


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="highlightsmith-analyzer",
        description="Offline analyzer scaffold for HighlightSmith.",
    )
    parser.add_argument("source", nargs="?", help="Local media path to analyze.")
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Run the analyzer with built-in mock transcript and signal data.",
    )
    parser.add_argument(
        "--persist",
        action="store_true",
        help="Persist the resulting project session to SQLite.",
    )
    parser.add_argument(
        "--database",
        default=".local/highlightsmith.sqlite3",
        help="SQLite path used when --persist is supplied.",
    )
    parser.add_argument(
        "--profile",
        default="generic",
        help="Profile id placeholder for future weighting selection.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if not args.mock and not args.source:
        parser.error("provide a source path or pass --mock")

    settings = Settings(use_mock_data=bool(args.mock))
    session = analyze_media(args.source, settings=settings, profile_id=args.profile)

    if args.persist:
        store = SessionStore(args.database)
        store.initialize()
        store.save_session(session)

    print(json.dumps(_convert(session), indent=2))
    return 0


def _convert(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if is_dataclass(value):
        return {
            key: _convert(inner_value)
            for key, inner_value in asdict(value).items()
        }
    if isinstance(value, dict):
        return {key: _convert(inner_value) for key, inner_value in value.items()}
    if isinstance(value, list):
        return [_convert(item) for item in value]
    return value


if __name__ == "__main__":
    raise SystemExit(main())
