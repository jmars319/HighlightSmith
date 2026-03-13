from __future__ import annotations

from typing import Protocol

from ..contracts import MediaSource, TranscriptChunk


class TranscriptProvider(Protocol):
    def transcribe(self, media_source: MediaSource) -> list[TranscriptChunk]:
        ...
