from __future__ import annotations

from pathlib import Path

from ..contracts import MediaSource
from ..mock_data import build_mock_media_source

SUPPORTED_EXTENSIONS = {".mp4", ".mkv", ".mov", ".wav", ".mp3", ".m4a"}


def inspect_media(source_path: str | None, use_mock_data: bool) -> MediaSource:
    if use_mock_data or not source_path:
        return build_mock_media_source(source_path)

    path = Path(source_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Media file not found: {path}")

    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported media extension: {path.suffix}")

    # TODO: Replace duration/frame-rate placeholders with ffprobe integration.
    return MediaSource(
        id=f"media_{path.stem}",
        path=str(path),
        kind="AUDIO" if path.suffix.lower() in {".wav", ".mp3", ".m4a"} else "VIDEO",
        file_name=path.name,
        duration_seconds=3600.0,
        format=path.suffix.lower().lstrip("."),
        file_size_bytes=path.stat().st_size,
        frame_rate=None,
        ingest_notes=[
            "Metadata probing is currently stubbed.",
            "FFmpeg/ffprobe wrapper belongs in packages/media and a future Rust bridge.",
        ],
    )
