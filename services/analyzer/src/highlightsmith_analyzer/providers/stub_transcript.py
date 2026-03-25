from __future__ import annotations

import hashlib

from ..contracts import MediaSource, TranscriptChunk


class StubTranscriptProvider:
    """Returns deterministic local transcript anchors for provisional real-file runs."""

    def transcribe(self, media_source: MediaSource) -> list[TranscriptChunk]:
        phrase_templates = [
            "wait wait no way that worked",
            "okay here we go push now",
            "we survived that by inches",
            "this might be bad unless that puzzle path loops back",
        ]
        base_ratios = [0.14, 0.33, 0.58, 0.79]
        duration_seconds = max(media_source.duration_seconds, 240.0)
        left_margin = min(90.0, max(24.0, duration_seconds * 0.08))
        right_margin = min(90.0, max(36.0, duration_seconds * 0.1))
        usable_duration = max(120.0, duration_seconds - left_margin - right_margin)
        seed = hashlib.sha1(media_source.path.encode("utf-8")).digest()

        transcript: list[TranscriptChunk] = []
        for index, phrase in enumerate(phrase_templates, start=1):
            jitter = ((seed[index - 1] / 255.0) - 0.5) * 0.08
            ratio = min(0.9, max(0.08, base_ratios[index - 1] + jitter))
            center_seconds = left_margin + (usable_duration * ratio)
            start_seconds = max(0.0, min(duration_seconds - 5.0, center_seconds - 2.0))
            end_seconds = min(duration_seconds, start_seconds + 4.0)

            transcript.append(
                TranscriptChunk(
                    id=f"chunk_{index:03d}",
                    start_seconds=round(start_seconds, 2),
                    end_seconds=round(end_seconds, 2),
                    text=phrase,
                    confidence=0.58,
                )
            )

        return transcript
