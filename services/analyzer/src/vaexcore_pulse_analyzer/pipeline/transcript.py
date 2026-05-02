from __future__ import annotations

from ..contracts import MediaSource, Settings, TranscriptChunk
from ..providers.stub_transcript import StubTranscriptProvider


def generate_transcript(
    media_source: MediaSource,
    settings: Settings,
) -> list[TranscriptChunk]:
    if settings.transcript_provider == "stub-local":
        provider = StubTranscriptProvider()
        return provider.transcribe(media_source)

    # TODO: Wire provider interface to real offline STT implementation(s).
    return []
