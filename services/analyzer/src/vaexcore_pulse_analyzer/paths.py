from __future__ import annotations

import os
from pathlib import Path

APP_DATA_DIR_NAME = "vaexcore pulse"
DATABASE_FILENAME = "vaexcore-pulse.sqlite3"
LEGACY_DATABASE_PATH = Path(".local") / DATABASE_FILENAME
THUMBNAIL_OUTPUT_DIR_NAME = "thumbnail-suggestions"
LEGACY_THUMBNAIL_OUTPUT_ROOT = Path(".local") / THUMBNAIL_OUTPUT_DIR_NAME


def resolve_app_data_dir() -> Path:
    return Path.home() / "Library" / "Application Support" / APP_DATA_DIR_NAME


def resolve_default_database_path(configured_path: str | None = None) -> str:
    if configured_path is None:
        configured_path = os.getenv("VAEXCORE_PULSE_ANALYZER_DATABASE_PATH")

    if configured_path and configured_path.strip():
        return configured_path

    app_support_path = resolve_app_data_dir() / DATABASE_FILENAME
    if LEGACY_DATABASE_PATH.exists() and not app_support_path.exists():
        return str(LEGACY_DATABASE_PATH)

    return str(app_support_path)


def resolve_thumbnail_output_root() -> Path:
    app_support_path = resolve_app_data_dir() / THUMBNAIL_OUTPUT_DIR_NAME
    if LEGACY_THUMBNAIL_OUTPUT_ROOT.exists() and not app_support_path.exists():
        return LEGACY_THUMBNAIL_OUTPUT_ROOT

    return app_support_path
