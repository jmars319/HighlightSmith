from __future__ import annotations

import hashlib
import json
import math
import shutil
import struct
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..contracts import (
    MediaIndexArtifact,
    MediaIndexArtifactKind,
    MediaIndexArtifactMethod,
    MediaIndexAudioBucket,
    MediaIndexSummary,
)
from .ingest import inspect_media_with_metadata

MEDIA_INDEX_VERSION = "MEDIA_INDEX_V1"
DEFAULT_BUCKET_DURATION_SECONDS = 30.0
MAX_AUDIO_PROXY_BUCKETS = 720
SAMPLE_BYTES_PER_BUCKET = 4096
DECODED_AUDIO_SAMPLE_RATE = 1000
DECODED_AUDIO_SAMPLE_WIDTH_BYTES = 2
MAX_DECODED_AUDIO_BUCKETS = 720
MAX_DECODED_AUDIO_SECONDS = 14_400.0
FFMPEG_DECODE_TIMEOUT_SECONDS = 180


def build_media_index_summary(source_path: str) -> MediaIndexSummary:
    media_source, metadata = inspect_media_with_metadata(
        source_path,
        use_mock_data=False,
    )
    streams = metadata.get("streams", []) if metadata else []
    video_stream = _first_stream(streams, "video")
    audio_stream = _first_stream(streams, "audio")

    return MediaIndexSummary(
        method_version=MEDIA_INDEX_VERSION,
        generated_at=datetime.now(timezone.utc).isoformat(),
        source_path=media_source.path,
        file_name=media_source.file_name,
        file_size_bytes=media_source.file_size_bytes,
        kind=media_source.kind,
        format=str(
            metadata.get("format", {}).get("format_name")
            if metadata
            else media_source.format
        ),
        duration_seconds=round(media_source.duration_seconds, 2),
        frame_rate=media_source.frame_rate,
        width=_positive_int(video_stream.get("width") if video_stream else None),
        height=_positive_int(video_stream.get("height") if video_stream else None),
        video_codec=_optional_string(video_stream.get("codec_name") if video_stream else None),
        audio_codec=_optional_string(audio_stream.get("codec_name") if audio_stream else None),
        has_video=video_stream is not None,
        has_audio=audio_stream is not None,
        stream_count=len(streams),
        notes=media_source.ingest_notes,
    )


def build_media_index_artifacts(
    *,
    asset_id: str,
    job_id: str,
    index_summary: MediaIndexSummary,
) -> list[MediaIndexArtifact]:
    decoded_audio_artifact = build_decoded_audio_fingerprint_artifact(
        asset_id=asset_id,
        job_id=job_id,
        index_summary=index_summary,
    )
    if decoded_audio_artifact is not None:
        return [decoded_audio_artifact]

    audio_artifact = build_audio_fingerprint_artifact(
        asset_id=asset_id,
        job_id=job_id,
        index_summary=index_summary,
    )
    return [audio_artifact]


def build_decoded_audio_fingerprint_artifact(
    *,
    asset_id: str,
    job_id: str,
    index_summary: MediaIndexSummary,
) -> MediaIndexArtifact | None:
    if not index_summary.has_audio and index_summary.kind != "AUDIO":
        return None

    pcm_bytes = _decode_low_rate_pcm(index_summary)
    if not pcm_bytes:
        return None

    return build_decoded_audio_fingerprint_artifact_from_pcm(
        asset_id=asset_id,
        job_id=job_id,
        index_summary=index_summary,
        pcm_bytes=pcm_bytes,
    )


def build_decoded_audio_fingerprint_artifact_from_pcm(
    *,
    asset_id: str,
    job_id: str,
    index_summary: MediaIndexSummary,
    pcm_bytes: bytes,
) -> MediaIndexArtifact | None:
    sample_count = len(pcm_bytes) // DECODED_AUDIO_SAMPLE_WIDTH_BYTES
    if sample_count <= 0:
        return None

    decoded_duration_seconds = min(
        index_summary.duration_seconds,
        sample_count / DECODED_AUDIO_SAMPLE_RATE,
        MAX_DECODED_AUDIO_SECONDS,
    )
    if decoded_duration_seconds <= 0:
        return None

    now = datetime.now(timezone.utc).isoformat()
    bucket_duration_seconds = max(
        DEFAULT_BUCKET_DURATION_SECONDS,
        math.ceil(decoded_duration_seconds / MAX_DECODED_AUDIO_BUCKETS),
    )
    bucket_count = max(1, math.ceil(decoded_duration_seconds / bucket_duration_seconds))
    buckets = [
        _build_decoded_audio_bucket(
            index=index,
            bucket_duration_seconds=bucket_duration_seconds,
            decoded_duration_seconds=decoded_duration_seconds,
            pcm_bytes=pcm_bytes,
        )
        for index in range(bucket_count)
    ]
    buckets = [bucket for bucket in buckets if bucket is not None]
    if not buckets:
        return None

    energy_values = [bucket.energy_score for bucket in buckets]
    onset_values = [bucket.onset_score for bucket in buckets]
    silence_values = [bucket.silence_score for bucket in buckets]
    payload_byte_size = len(
        json.dumps([_bucket_payload(bucket) for bucket in buckets], separators=(",", ":")).encode(
            "utf-8"
        )
    )
    artifact_id_seed = f"decoded:{asset_id}:{job_id}:{index_summary.source_path}:{now}"

    return MediaIndexArtifact(
        id=f"artifact_audio_{hashlib.sha1(artifact_id_seed.encode('utf-8')).hexdigest()[:12]}",
        asset_id=asset_id,
        job_id=job_id,
        kind=MediaIndexArtifactKind.AUDIO_FINGERPRINT,
        method=MediaIndexArtifactMethod.DECODED_AUDIO_FINGERPRINT_V1,
        bucket_duration_seconds=bucket_duration_seconds,
        duration_seconds=round(decoded_duration_seconds, 2),
        bucket_count=len(buckets),
        confidence_score=0.78,
        payload_byte_size=payload_byte_size,
        energy_mean=_mean(energy_values),
        energy_peak=max(energy_values, default=0.0),
        onset_mean=_mean(onset_values),
        silence_share=_mean(silence_values),
        buckets=buckets,
        note=(
            "Decoded low-rate mono PCM fingerprint. This is still compact and bounded, "
            "but it measures audio content instead of container bytes."
        ),
        created_at=now,
        updated_at=now,
    )


def build_audio_fingerprint_artifact(
    *,
    asset_id: str,
    job_id: str,
    index_summary: MediaIndexSummary,
) -> MediaIndexArtifact:
    now = datetime.now(timezone.utc).isoformat()
    bucket_duration_seconds = _bucket_duration_seconds(index_summary.duration_seconds)
    bucket_count = max(
        1,
        math.ceil(index_summary.duration_seconds / bucket_duration_seconds),
    )
    buckets = [
        _build_proxy_audio_bucket(
            index=index,
            bucket_count=bucket_count,
            bucket_duration_seconds=bucket_duration_seconds,
            index_summary=index_summary,
        )
        for index in range(bucket_count)
    ]
    energy_values = [bucket.energy_score for bucket in buckets]
    onset_values = [bucket.onset_score for bucket in buckets]
    silence_values = [bucket.silence_score for bucket in buckets]
    payload_byte_size = len(
        json.dumps([_bucket_payload(bucket) for bucket in buckets], separators=(",", ":")).encode(
            "utf-8"
        )
    )
    has_confirmed_audio = index_summary.has_audio or index_summary.kind == "AUDIO"
    artifact_id_seed = f"{asset_id}:{job_id}:{index_summary.source_path}:{now}"

    return MediaIndexArtifact(
        id=f"artifact_audio_{hashlib.sha1(artifact_id_seed.encode('utf-8')).hexdigest()[:12]}",
        asset_id=asset_id,
        job_id=job_id,
        kind=MediaIndexArtifactKind.AUDIO_FINGERPRINT,
        method=MediaIndexArtifactMethod.BYTE_SAMPLED_AUDIO_PROXY_V1,
        bucket_duration_seconds=bucket_duration_seconds,
        duration_seconds=round(index_summary.duration_seconds, 2),
        bucket_count=len(buckets),
        confidence_score=0.32 if has_confirmed_audio else 0.18,
        payload_byte_size=payload_byte_size,
        energy_mean=_mean(energy_values),
        energy_peak=max(energy_values, default=0.0),
        onset_mean=_mean(onset_values),
        silence_share=_mean(silence_values),
        buckets=buckets,
        note=(
            "Bounded byte-sampled audio proxy. This stores stable time-bucketed signatures "
            "without decoding the full media file; it is suitable for plumbing and coarse future "
            "matching, but not yet a high-confidence decoded audio fingerprint."
        ),
        created_at=now,
        updated_at=now,
    )


def _bucket_duration_seconds(duration_seconds: float) -> float:
    if duration_seconds <= 0:
        return DEFAULT_BUCKET_DURATION_SECONDS
    return max(
        DEFAULT_BUCKET_DURATION_SECONDS,
        math.ceil(duration_seconds / MAX_AUDIO_PROXY_BUCKETS),
    )


def _build_proxy_audio_bucket(
    *,
    index: int,
    bucket_count: int,
    bucket_duration_seconds: float,
    index_summary: MediaIndexSummary,
) -> MediaIndexAudioBucket:
    start_seconds = round(index * bucket_duration_seconds, 2)
    end_seconds = round(
        min((index + 1) * bucket_duration_seconds, index_summary.duration_seconds),
        2,
    )
    sample = _read_bounded_media_sample(
        index_summary.source_path,
        index,
        bucket_count,
        index_summary.file_size_bytes,
    )
    if not sample:
        sample = hashlib.sha1(
            f"{index_summary.source_path}:{index_summary.file_size_bytes}:{index}".encode(
                "utf-8"
            )
        ).digest()

    energy_score = _clamp(sum(sample) / (len(sample) * 255))
    onset_score = _clamp(_mean_absolute_delta(sample) / 255)
    spectral_flux_score = _clamp(_byte_stddev(sample) / 128)
    silence_score = _clamp(1 - (energy_score * 1.7))
    fingerprint_seed = sample + f":{index}:{start_seconds}:{end_seconds}".encode("utf-8")

    return MediaIndexAudioBucket(
        index=index,
        start_seconds=start_seconds,
        end_seconds=end_seconds,
        energy_score=round(energy_score, 4),
        onset_score=round(onset_score, 4),
        spectral_flux_score=round(spectral_flux_score, 4),
        silence_score=round(silence_score, 4),
        fingerprint=hashlib.sha1(fingerprint_seed).hexdigest()[:20],
    )


def _decode_low_rate_pcm(index_summary: MediaIndexSummary) -> bytes | None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None

    decode_seconds = min(index_summary.duration_seconds, MAX_DECODED_AUDIO_SECONDS)
    if decode_seconds <= 0:
        return None

    try:
        result = subprocess.run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                index_summary.source_path,
                "-vn",
                "-ac",
                "1",
                "-ar",
                str(DECODED_AUDIO_SAMPLE_RATE),
                "-t",
                f"{decode_seconds:.2f}",
                "-f",
                "s16le",
                "-acodec",
                "pcm_s16le",
                "-",
            ],
            capture_output=True,
            check=False,
            timeout=FFMPEG_DECODE_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None

    if result.returncode != 0 or not result.stdout:
        return None
    return result.stdout


def _build_decoded_audio_bucket(
    *,
    index: int,
    bucket_duration_seconds: float,
    decoded_duration_seconds: float,
    pcm_bytes: bytes,
) -> MediaIndexAudioBucket | None:
    start_seconds = round(index * bucket_duration_seconds, 2)
    end_seconds = round(
        min((index + 1) * bucket_duration_seconds, decoded_duration_seconds),
        2,
    )
    if end_seconds <= start_seconds:
        return None

    start_sample = int(start_seconds * DECODED_AUDIO_SAMPLE_RATE)
    end_sample = int(end_seconds * DECODED_AUDIO_SAMPLE_RATE)
    sample_bytes = pcm_bytes[
        start_sample * DECODED_AUDIO_SAMPLE_WIDTH_BYTES : end_sample
        * DECODED_AUDIO_SAMPLE_WIDTH_BYTES
    ]
    samples = [
        value[0]
        for value in struct.iter_unpack(
            "<h",
            sample_bytes[: len(sample_bytes) - (len(sample_bytes) % 2)],
        )
    ]
    if not samples:
        return None

    rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples)) / 32768
    mean_abs_delta = (
        sum(abs(samples[index] - samples[index - 1]) for index in range(1, len(samples)))
        / max(len(samples) - 1, 1)
    )
    zero_crossing_rate = (
        sum(
            1
            for sample_index in range(1, len(samples))
            if (samples[sample_index] >= 0) != (samples[sample_index - 1] >= 0)
        )
        / max(len(samples) - 1, 1)
    )
    silence_share = sum(1 for sample in samples if abs(sample) < 512) / len(samples)
    fingerprint_seed = (
        f"{index}:{start_seconds}:{end_seconds}:"
        f"{round(rms, 4)}:{round(mean_abs_delta / 32768, 4)}:"
        f"{round(zero_crossing_rate, 4)}:{round(silence_share, 4)}"
    )

    return MediaIndexAudioBucket(
        index=index,
        start_seconds=start_seconds,
        end_seconds=end_seconds,
        energy_score=round(_clamp(rms * 2.25), 4),
        onset_score=round(_clamp(mean_abs_delta / 32768), 4),
        spectral_flux_score=round(_clamp(zero_crossing_rate * 3.0), 4),
        silence_score=round(_clamp(silence_share), 4),
        fingerprint=hashlib.sha1(fingerprint_seed.encode("utf-8")).hexdigest()[:20],
    )


def _read_bounded_media_sample(
    source_path: str,
    index: int,
    bucket_count: int,
    file_size_bytes: int,
) -> bytes:
    if file_size_bytes <= 0:
        return b""

    path = Path(source_path)
    if not path.exists() or not path.is_file():
        return b""

    max_offset = max(file_size_bytes - SAMPLE_BYTES_PER_BUCKET, 0)
    offset = int(max_offset * ((index + 0.5) / max(bucket_count, 1)))
    try:
        with path.open("rb") as file:
            file.seek(offset)
            return file.read(SAMPLE_BYTES_PER_BUCKET)
    except OSError:
        return b""


def _bucket_payload(bucket: MediaIndexAudioBucket) -> dict[str, Any]:
    return {
        "index": bucket.index,
        "start_seconds": bucket.start_seconds,
        "end_seconds": bucket.end_seconds,
        "energy_score": bucket.energy_score,
        "onset_score": bucket.onset_score,
        "spectral_flux_score": bucket.spectral_flux_score,
        "silence_score": bucket.silence_score,
        "fingerprint": bucket.fingerprint,
    }


def _mean_absolute_delta(sample: bytes) -> float:
    if len(sample) < 2:
        return 0.0
    return sum(abs(sample[index] - sample[index - 1]) for index in range(1, len(sample))) / (
        len(sample) - 1
    )


def _byte_stddev(sample: bytes) -> float:
    if not sample:
        return 0.0
    mean_value = sum(sample) / len(sample)
    variance = sum((value - mean_value) ** 2 for value in sample) / len(sample)
    return math.sqrt(variance)


def _mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 4)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def _first_stream(streams: list[Any], codec_type: str) -> dict[str, Any] | None:
    for stream in streams:
        if isinstance(stream, dict) and stream.get("codec_type") == codec_type:
            return stream
    return None


def _positive_int(value: Any) -> int | None:
    try:
        parsed_value = int(value)
    except (TypeError, ValueError):
        return None
    return parsed_value if parsed_value > 0 else None


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    parsed_value = str(value).strip()
    return parsed_value or None
