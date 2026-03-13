from __future__ import annotations

from dataclasses import dataclass

from ..contracts import (
    CandidateWindow,
    ConfidenceBand,
    FeatureWindow,
    ReasonCode,
    ScoreContribution,
    Settings,
    SpeechRegion,
    SuggestedSegment,
    TimeRange,
    TranscriptChunk,
)


@dataclass
class CandidateSeed:
    start_seconds: float
    end_seconds: float
    transcript_snippet: str
    editable_label: str
    score_breakdown: list[ScoreContribution]
    context_required: bool


def _confidence_band(score_estimate: float) -> ConfidenceBand:
    if score_estimate >= 0.8:
        return ConfidenceBand.HIGH
    if score_estimate >= 0.58:
        return ConfidenceBand.MEDIUM
    if score_estimate >= 0.35:
        return ConfidenceBand.LOW
    return ConfidenceBand.EXPERIMENTAL


def generate_candidate_seeds(
    transcript: list[TranscriptChunk],
    speech_regions: list[SpeechRegion],
    feature_windows: list[FeatureWindow],
    settings: Settings,
) -> list[CandidateSeed]:
    seeds: list[CandidateSeed] = []

    for chunk in transcript:
        lowered = chunk.text.lower()
        overlapping_features = [
            feature
            for feature in feature_windows
            if feature.start_seconds < chunk.end_seconds and feature.end_seconds > chunk.start_seconds
        ]
        overlapping_speech = [
            speech
            for speech in speech_regions
            if speech.start_seconds < chunk.end_seconds and speech.end_seconds > chunk.start_seconds
        ]

        contributions: list[ScoreContribution] = []
        label = "Potential highlight"
        context_required = False

        if "wait wait" in lowered or "no way" in lowered:
            contributions.append(
                ScoreContribution(
                    reason_code=ReasonCode.REACTION_PHRASE,
                    label="Reaction phrase cluster",
                    contribution=0.38,
                    direction="POSITIVE",
                )
            )
            label = "Clutch escape payoff"

        if "here we go" in lowered or "push now" in lowered:
            contributions.append(
                ScoreContribution(
                    reason_code=ReasonCode.STRUCTURE_SETUP,
                    label="Setup language before action",
                    contribution=0.18,
                    direction="POSITIVE",
                )
            )
            contributions.append(
                ScoreContribution(
                    reason_code=ReasonCode.TACTICAL_NARRATION,
                    label="Tactical framing",
                    contribution=0.24,
                    direction="POSITIVE",
                )
            )
            label = "Push call before engagement"

        if "we survived" in lowered:
            contributions.append(
                ScoreContribution(
                    reason_code=ReasonCode.STRUCTURE_CONSEQUENCE,
                    label="Consequence follows action",
                    contribution=0.22,
                    direction="POSITIVE",
                )
            )
            contributions.append(
                ScoreContribution(
                    reason_code=ReasonCode.STRUCTURE_RESOLUTION,
                    label="Payoff language",
                    contribution=0.17,
                    direction="POSITIVE",
                )
            )
            label = "Near-wipe recovery"

        if "this might be bad" in lowered:
            contributions.append(
                ScoreContribution(
                    reason_code=ReasonCode.STRUCTURE_SETUP,
                    label="Promising setup language",
                    contribution=0.18,
                    direction="POSITIVE",
                )
            )
            contributions.append(
                ScoreContribution(
                    reason_code=ReasonCode.CONTEXT_REQUIRED,
                    label="Needs surrounding context",
                    contribution=-0.07,
                    direction="NEGATIVE",
                )
            )
            contributions.append(
                ScoreContribution(
                    reason_code=ReasonCode.LOW_INFORMATION,
                    label="Weak supporting signal density",
                    contribution=-0.10,
                    direction="NEGATIVE",
                )
            )
            label = "Puzzle tension setup"
            context_required = True

        if overlapping_features:
            dominant_feature = max(overlapping_features, key=lambda feature: feature.rms_loudness)
            if dominant_feature.rms_loudness >= 0.7:
                contributions.append(
                    ScoreContribution(
                        reason_code=ReasonCode.LOUDNESS_SPIKE,
                        label="Loudness spike",
                        contribution=0.27,
                        direction="POSITIVE",
                    )
                )
            if dominant_feature.overlap_activity >= 0.58:
                contributions.append(
                    ScoreContribution(
                        reason_code=ReasonCode.OVERLAP_SPIKE,
                        label="Overlapping speech spike",
                        contribution=0.30,
                        direction="POSITIVE",
                    )
                )
            if dominant_feature.speech_density >= 0.75:
                contributions.append(
                    ScoreContribution(
                        reason_code=ReasonCode.COMMENTARY_DENSITY,
                        label="Sustained commentary density",
                        contribution=0.23,
                        direction="POSITIVE",
                    )
                )
            if dominant_feature.laughter_like_burst >= 0.7:
                contributions.append(
                    ScoreContribution(
                        reason_code=ReasonCode.LAUGHTER_BURST,
                        label="Laughter-like burst",
                        contribution=0.27,
                        direction="POSITIVE",
                    )
                )

        if not overlapping_speech and not contributions:
            continue

        start_seconds = max(0.0, chunk.start_seconds - settings.suggested_setup_padding_seconds - 2.0)
        end_seconds = min(
            chunk.end_seconds + settings.suggested_resolution_padding_seconds + 20.0,
            chunk.end_seconds + settings.candidate_window_max_seconds,
        )

        seeds.append(
            CandidateSeed(
                start_seconds=start_seconds,
                end_seconds=end_seconds,
                transcript_snippet=chunk.text,
                editable_label=label,
                score_breakdown=_deduplicate_contributions(contributions),
                context_required=context_required,
            )
        )

    return seeds


def shape_candidates(seeds: list[CandidateSeed], settings: Settings) -> list[CandidateWindow]:
    candidates: list[CandidateWindow] = []

    for index, seed in enumerate(seeds, start=1):
        score_estimate = max(
            0.0,
            min(1.0, sum(item.contribution for item in seed.score_breakdown)),
        )
        confidence_band = _confidence_band(score_estimate)
        suggested_start = max(0.0, seed.start_seconds + 6.0)
        suggested_end = max(
            suggested_start + settings.candidate_window_min_seconds,
            min(seed.end_seconds - 6.0, seed.start_seconds + 34.0),
        )

        candidates.append(
            CandidateWindow(
                id=f"candidate_{index:03d}",
                candidate_window=TimeRange(seed.start_seconds, seed.end_seconds),
                suggested_segment=SuggestedSegment(
                    start_seconds=suggested_start,
                    end_seconds=suggested_end,
                    setup_padding_seconds=settings.suggested_setup_padding_seconds,
                    resolution_padding_seconds=settings.suggested_resolution_padding_seconds,
                    trim_dead_air_applied=True if score_estimate >= 0.75 else False,
                ),
                confidence_band=confidence_band,
                score_estimate=round(score_estimate, 2),
                reason_codes=[item.reason_code for item in seed.score_breakdown],
                transcript_snippet=seed.transcript_snippet,
                score_breakdown=seed.score_breakdown,
                context_required=seed.context_required,
                editable_label=seed.editable_label,
            )
        )

    return candidates


def _deduplicate_contributions(
    contributions: list[ScoreContribution],
) -> list[ScoreContribution]:
    deduped: list[ScoreContribution] = []
    seen = set()

    for contribution in contributions:
        if contribution.reason_code in seen:
            continue
        seen.add(contribution.reason_code)
        deduped.append(contribution)

    return deduped
