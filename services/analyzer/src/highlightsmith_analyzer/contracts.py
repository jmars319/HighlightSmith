from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class ConfidenceBand(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    EXPERIMENTAL = "EXPERIMENTAL"


class ReasonCode(str, Enum):
    LOUDNESS_SPIKE = "LOUDNESS_SPIKE"
    LAUGHTER_BURST = "LAUGHTER_BURST"
    OVERLAP_SPIKE = "OVERLAP_SPIKE"
    REACTION_PHRASE = "REACTION_PHRASE"
    COMMENTARY_DENSITY = "COMMENTARY_DENSITY"
    SILENCE_BREAK = "SILENCE_BREAK"
    ACTION_AUDIO_CLUSTER = "ACTION_AUDIO_CLUSTER"
    STRUCTURE_SETUP = "STRUCTURE_SETUP"
    STRUCTURE_CONSEQUENCE = "STRUCTURE_CONSEQUENCE"
    STRUCTURE_RESOLUTION = "STRUCTURE_RESOLUTION"
    MENU_HEAVY = "MENU_HEAVY"
    CLEANUP_HEAVY = "CLEANUP_HEAVY"
    LOW_INFORMATION = "LOW_INFORMATION"
    CONTEXT_REQUIRED = "CONTEXT_REQUIRED"
    TACTICAL_NARRATION = "TACTICAL_NARRATION"
    PITCH_EXCURSION = "PITCH_EXCURSION"
    ABRUPT_SILENCE_AFTER_INTENSITY = "ABRUPT_SILENCE_AFTER_INTENSITY"


class ReviewAction(str, Enum):
    PENDING = "PENDING"
    ACCEPT = "ACCEPT"
    REJECT = "REJECT"
    RETIME = "RETIME"
    RELABEL = "RELABEL"


@dataclass
class TimeRange:
    start_seconds: float
    end_seconds: float


@dataclass
class MediaSource:
    id: str
    path: str
    kind: str
    file_name: str
    duration_seconds: float
    format: str
    file_size_bytes: int = 0
    frame_rate: Optional[float] = None
    ingest_notes: List[str] = field(default_factory=list)


@dataclass
class TranscriptChunk:
    id: str
    start_seconds: float
    end_seconds: float
    text: str
    confidence: Optional[float] = None


@dataclass
class SpeechRegion:
    id: str
    start_seconds: float
    end_seconds: float
    speech_density: float
    overlap_activity: float


@dataclass
class FeatureWindow:
    id: str
    start_seconds: float
    end_seconds: float
    rms_loudness: float
    onset_density: float
    spectral_contrast: float
    zero_crossing_rate: float
    speech_density: float
    overlap_activity: float
    laughter_like_burst: float
    pitch_excursion: float
    abrupt_silence_after_intensity: float


@dataclass
class ScoreContribution:
    reason_code: ReasonCode
    label: str
    contribution: float
    direction: str


@dataclass
class SuggestedSegment:
    start_seconds: float
    end_seconds: float
    setup_padding_seconds: float
    resolution_padding_seconds: float
    trim_dead_air_applied: bool


@dataclass
class CandidateWindow:
    id: str
    candidate_window: TimeRange
    suggested_segment: SuggestedSegment
    confidence_band: ConfidenceBand
    score_estimate: float
    reason_codes: List[ReasonCode]
    transcript_snippet: str
    score_breakdown: List[ScoreContribution]
    context_required: bool
    editable_label: str


@dataclass
class ReviewDecision:
    id: str
    project_session_id: str
    candidate_id: str
    action: ReviewAction
    label: Optional[str] = None
    adjusted_segment: Optional[TimeRange] = None
    notes: Optional[str] = None
    created_at: str = ""


@dataclass
class ContentProfile:
    id: str
    label: str
    description: str
    mode: str
    signal_weights: Dict[ReasonCode, float]


@dataclass
class Settings:
    micro_window_seconds: float = 2.0
    candidate_window_min_seconds: float = 15.0
    candidate_window_max_seconds: float = 45.0
    suggested_setup_padding_seconds: float = 6.0
    suggested_resolution_padding_seconds: float = 8.0
    experimental_candidate_quota: int = 2
    transcript_provider: str = "stub-local"
    run_offline_only: bool = True
    use_mock_data: bool = False


@dataclass
class ProjectSession:
    id: str
    title: str
    status: str
    media_source: MediaSource
    profile_id: str
    settings: Settings
    transcript: List[TranscriptChunk]
    speech_regions: List[SpeechRegion]
    feature_windows: List[FeatureWindow]
    candidates: List[CandidateWindow]
    review_decisions: List[ReviewDecision]
    created_at: str
    updated_at: str
