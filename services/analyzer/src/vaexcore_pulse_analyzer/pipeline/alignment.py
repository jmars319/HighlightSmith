from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from ..contracts import (
    MediaAlignmentBucketMatch,
    MediaAlignmentMatch,
    MediaAlignmentMatchKind,
    MediaAlignmentMethod,
    MediaIndexArtifact,
    MediaIndexArtifactMethod,
    TimeRange,
)

MAX_ALIGNMENT_MATCHES = 5
MIN_ALIGNMENT_SCORE = 0.58
PROXY_CONFIDENCE_CAP = 0.52
DECODED_CONFIDENCE_CAP = 0.82


def build_audio_proxy_alignment_matches(
    *,
    job_id: str,
    source_asset_id: str,
    query_asset_id: str,
    source_artifact: MediaIndexArtifact,
    query_artifact: MediaIndexArtifact,
    pair_id: str | None = None,
) -> list[MediaAlignmentMatch]:
    if not source_artifact.buckets or not query_artifact.buckets:
        return []

    now = datetime.now(timezone.utc).isoformat()
    window_size = _query_window_size(len(query_artifact.buckets))
    candidates: list[tuple[float, int, int, list[MediaAlignmentBucketMatch]]] = []

    for query_start in range(0, len(query_artifact.buckets), max(1, window_size // 2)):
        query_window = query_artifact.buckets[query_start : query_start + window_size]
        if not query_window:
            continue

        best_score = 0.0
        best_source_start = 0
        best_bucket_matches: list[MediaAlignmentBucketMatch] = []
        for source_start in range(0, max(len(source_artifact.buckets) - len(query_window) + 1, 1)):
            source_window = source_artifact.buckets[source_start : source_start + len(query_window)]
            if len(source_window) != len(query_window):
                continue

            bucket_matches = [
                MediaAlignmentBucketMatch(
                    query_bucket_index=query_bucket.index,
                    source_bucket_index=source_bucket.index,
                    score=round(_bucket_similarity(source_bucket, query_bucket), 4),
                )
                for source_bucket, query_bucket in zip(source_window, query_window)
            ]
            score = _mean([match.score for match in bucket_matches])
            if score > best_score:
                best_score = score
                best_source_start = source_start
                best_bucket_matches = bucket_matches

        if best_score >= MIN_ALIGNMENT_SCORE:
            candidates.append((best_score, query_start, best_source_start, best_bucket_matches))

    selected_candidates = _select_non_overlapping_candidates(candidates)
    uses_decoded_audio = (
        source_artifact.method == MediaIndexArtifactMethod.DECODED_AUDIO_FINGERPRINT_V1
        and query_artifact.method == MediaIndexArtifactMethod.DECODED_AUDIO_FINGERPRINT_V1
    )
    alignment_method = (
        MediaAlignmentMethod.DECODED_AUDIO_BUCKET_CORRELATION_V1
        if uses_decoded_audio
        else MediaAlignmentMethod.AUDIO_PROXY_BUCKET_CORRELATION_V1
    )
    confidence_cap = DECODED_CONFIDENCE_CAP if uses_decoded_audio else PROXY_CONFIDENCE_CAP
    match_kind = (
        MediaAlignmentMatchKind.EDIT_TO_VOD_KEEP
        if pair_id
        else MediaAlignmentMatchKind.CLIP_TO_VOD_MATCH
    )

    matches: list[MediaAlignmentMatch] = []
    for rank, (score, query_start, source_start, bucket_matches) in enumerate(
        selected_candidates,
        start=1,
    ):
        query_window = query_artifact.buckets[query_start : query_start + len(bucket_matches)]
        source_window = source_artifact.buckets[source_start : source_start + len(bucket_matches)]
        if not query_window or not source_window:
            continue

        confidence_score = min(
            confidence_cap,
            score
            * max(source_artifact.confidence_score, 0.1)
            * max(query_artifact.confidence_score, 0.1)
            * (1.35 if uses_decoded_audio else 2.75),
        )
        match_id_seed = (
            f"{job_id}:{source_asset_id}:{query_asset_id}:{query_start}:{source_start}:{score}"
        )
        matches.append(
            MediaAlignmentMatch(
                id=f"align_match_{hashlib.sha1(match_id_seed.encode('utf-8')).hexdigest()[:12]}",
                job_id=job_id,
                pair_id=pair_id,
                source_asset_id=source_asset_id,
                query_asset_id=query_asset_id,
                kind=match_kind,
                method=alignment_method,
                source_range=TimeRange(
                    start_seconds=source_window[0].start_seconds,
                    end_seconds=source_window[-1].end_seconds,
                ),
                query_range=TimeRange(
                    start_seconds=query_window[0].start_seconds,
                    end_seconds=query_window[-1].end_seconds,
                ),
                score=round(score, 4),
                confidence_score=round(confidence_score, 4),
                matched_bucket_count=len(bucket_matches),
                total_query_bucket_count=len(query_artifact.buckets),
                bucket_matches=bucket_matches,
                note=_alignment_note(uses_decoded_audio),
                created_at=now,
                updated_at=now,
            )
        )

    return matches


def _alignment_note(uses_decoded_audio: bool) -> str:
    if uses_decoded_audio:
        return (
            "Candidate alignment from decoded low-rate audio fingerprints. "
            "This is content-derived and materially stronger than byte proxy matching, "
            "but still should be reviewed before treating it as final timeline truth."
        )

    return (
        "Candidate alignment from byte-sampled audio proxy buckets. Treat as a "
        "search hint until decoded audio fingerprints are available for both assets."
    )


def _query_window_size(query_bucket_count: int) -> int:
    if query_bucket_count <= 4:
        return max(query_bucket_count, 1)
    if query_bucket_count <= 16:
        return 4
    return 8


def _bucket_similarity(source_bucket: object, query_bucket: object) -> float:
    source = source_bucket  # Keeps attribute access readable.
    query = query_bucket
    distance = (
        abs(source.energy_score - query.energy_score) * 0.35
        + abs(source.onset_score - query.onset_score) * 0.25
        + abs(source.spectral_flux_score - query.spectral_flux_score) * 0.25
        + abs(source.silence_score - query.silence_score) * 0.15
    )
    score = max(0.0, min(1.0, 1.0 - distance))
    if source.fingerprint == query.fingerprint:
        score = min(1.0, score + 0.1)
    return score


def _select_non_overlapping_candidates(
    candidates: list[tuple[float, int, int, list[MediaAlignmentBucketMatch]]],
) -> list[tuple[float, int, int, list[MediaAlignmentBucketMatch]]]:
    selected: list[tuple[float, int, int, list[MediaAlignmentBucketMatch]]] = []
    used_source_ranges: list[tuple[int, int]] = []

    for candidate in sorted(candidates, key=lambda item: item[0], reverse=True):
        _score, _query_start, source_start, bucket_matches = candidate
        source_end = source_start + len(bucket_matches)
        if any(
            source_start < used_end and source_end > used_start
            for used_start, used_end in used_source_ranges
        ):
            continue

        selected.append(candidate)
        used_source_ranges.append((source_start, source_end))
        if len(selected) >= MAX_ALIGNMENT_MATCHES:
            break

    return selected


def _mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)
