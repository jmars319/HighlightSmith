from __future__ import annotations

from ..contracts import CandidateWindow, Settings


def apply_boundary_shaping(
    candidates: list[CandidateWindow],
    settings: Settings,
) -> list[CandidateWindow]:
    shaped: list[CandidateWindow] = []

    for candidate in candidates:
        segment = candidate.suggested_segment
        segment.start_seconds = max(
            candidate.candidate_window.start_seconds,
            segment.start_seconds - min(1.0, settings.suggested_setup_padding_seconds / 6.0),
        )
        segment.end_seconds = min(
            candidate.candidate_window.end_seconds,
            segment.end_seconds + min(1.0, settings.suggested_resolution_padding_seconds / 8.0),
        )
        shaped.append(candidate)

    return shaped
