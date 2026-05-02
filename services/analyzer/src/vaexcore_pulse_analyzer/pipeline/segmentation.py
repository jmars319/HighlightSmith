from __future__ import annotations

from ..contracts import TimeRange


def create_micro_windows(duration_seconds: float, window_seconds: float) -> list[TimeRange]:
    windows: list[TimeRange] = []
    cursor = 0.0

    while cursor < duration_seconds:
        next_cursor = min(cursor + window_seconds, duration_seconds)
        windows.append(TimeRange(start_seconds=cursor, end_seconds=next_cursor))
        cursor = next_cursor

    return windows
