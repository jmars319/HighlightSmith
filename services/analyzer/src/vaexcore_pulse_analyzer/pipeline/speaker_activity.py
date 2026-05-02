from __future__ import annotations

from ..contracts import SpeechRegion, TranscriptChunk


def estimate_speech_regions(transcript: list[TranscriptChunk]) -> list[SpeechRegion]:
    speech_regions: list[SpeechRegion] = []

    for index, chunk in enumerate(transcript, start=1):
        overlap_activity = 0.6 if "we survived" in chunk.text or "push now" in chunk.text else 0.2
        speech_regions.append(
            SpeechRegion(
                id=f"speech_{index:03d}",
                start_seconds=max(0.0, chunk.start_seconds - 4.0),
                end_seconds=chunk.end_seconds + 7.0,
                speech_density=min(0.95, 0.5 + (len(chunk.text.split()) * 0.05)),
                overlap_activity=overlap_activity,
            )
        )

    return speech_regions
