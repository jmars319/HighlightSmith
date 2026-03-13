from __future__ import annotations

from ..contracts import MediaSource, TranscriptChunk
from ..mock_data import build_mock_transcript


class StubTranscriptProvider:
    """Returns deterministic local transcript chunks for scaffold runs."""

    def transcribe(self, media_source: MediaSource) -> list[TranscriptChunk]:
        _ = media_source
        return build_mock_transcript()
