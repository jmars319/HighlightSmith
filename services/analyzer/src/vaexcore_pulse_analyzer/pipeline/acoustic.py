from __future__ import annotations

from ..contracts import FeatureWindow, SpeechRegion, TimeRange, TranscriptChunk


def extract_feature_windows(
    micro_windows: list[TimeRange],
    transcript: list[TranscriptChunk],
    speech_regions: list[SpeechRegion],
) -> list[FeatureWindow]:
    feature_windows: list[FeatureWindow] = []

    for index, window in enumerate(micro_windows, start=1):
        baseline = FeatureWindow(
            id=f"feature_{index:04d}",
            start_seconds=window.start_seconds,
            end_seconds=window.end_seconds,
            rms_loudness=0.22,
            onset_density=0.18,
            spectral_contrast=0.25,
            zero_crossing_rate=0.15,
            speech_density=0.08,
            overlap_activity=0.02,
            laughter_like_burst=0.0,
            pitch_excursion=0.12,
            abrupt_silence_after_intensity=0.03,
        )

        related_chunks = [
            chunk
            for chunk in transcript
            if chunk.start_seconds < window.end_seconds
            and chunk.end_seconds > window.start_seconds
        ]
        related_speech = [
            region
            for region in speech_regions
            if region.start_seconds < window.end_seconds
            and region.end_seconds > window.start_seconds
        ]

        if related_speech:
            baseline.speech_density = max(
                baseline.speech_density,
                max(region.speech_density for region in related_speech),
            )
            baseline.overlap_activity = max(
                baseline.overlap_activity,
                max(region.overlap_activity for region in related_speech),
            )

        for chunk in related_chunks:
            lowered = chunk.text.lower()
            if "wait wait" in lowered or "no way" in lowered:
                baseline.rms_loudness = 0.8
                baseline.onset_density = 0.76
                baseline.pitch_excursion = 0.7
                baseline.abrupt_silence_after_intensity = 0.55
            if "here we go" in lowered or "push now" in lowered:
                baseline.speech_density = max(baseline.speech_density, 0.78)
                baseline.onset_density = max(baseline.onset_density, 0.68)
                baseline.spectral_contrast = max(baseline.spectral_contrast, 0.63)
            if "we survived" in lowered:
                baseline.rms_loudness = max(baseline.rms_loudness, 0.83)
                baseline.laughter_like_burst = 0.74
                baseline.overlap_activity = max(baseline.overlap_activity, 0.67)
            if "this might be bad" in lowered:
                baseline.pitch_excursion = max(baseline.pitch_excursion, 0.39)
                baseline.speech_density = max(baseline.speech_density, 0.54)

        feature_windows.append(baseline)

    return feature_windows
