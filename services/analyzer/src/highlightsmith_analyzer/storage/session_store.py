from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, is_dataclass
from enum import Enum
from pathlib import Path
from typing import Any

from ..contracts import (
    AnalysisCoverage,
    AnalysisCoverageBand,
    AnalysisCoverageFlag,
    CandidateWindow,
    ConfidenceBand,
    FeatureWindow,
    MediaSource,
    ProjectSession,
    ReasonCode,
    ReviewTag,
    ReviewAction,
    ReviewDecision,
    ScoreContribution,
    Settings,
    SpeechRegion,
    SuggestedSegment,
    TimeRange,
    TranscriptChunk,
)
from ..pipeline.coverage import build_analysis_coverage
from ..pipeline.orchestrator import analyze_media

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS project_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  media_path TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  session_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidate_windows (
  id TEXT PRIMARY KEY,
  project_session_id TEXT NOT NULL,
  confidence_band TEXT NOT NULL,
  transcript_snippet TEXT NOT NULL,
  candidate_window_json TEXT NOT NULL,
  suggested_segment_json TEXT NOT NULL,
  score_breakdown_json TEXT NOT NULL,
  FOREIGN KEY (project_session_id) REFERENCES project_sessions(id)
);

CREATE TABLE IF NOT EXISTS review_decisions (
  id TEXT PRIMARY KEY,
  project_session_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  action TEXT NOT NULL,
  label TEXT,
  adjusted_segment_json TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_session_id) REFERENCES project_sessions(id)
);

CREATE TABLE IF NOT EXISTS analysis_artifacts (
  project_session_id TEXT PRIMARY KEY,
  transcript_json TEXT NOT NULL,
  speech_regions_json TEXT NOT NULL,
  feature_windows_json TEXT NOT NULL,
  FOREIGN KEY (project_session_id) REFERENCES project_sessions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS review_decisions_session_candidate_idx
ON review_decisions(project_session_id, candidate_id);
"""


class SessionStore:
    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.database_path) as connection:
            connection.executescript(SCHEMA_SQL)
            self._ensure_column(connection, "project_sessions", "session_json", "TEXT")
            connection.commit()

    def save_session(self, session: ProjectSession) -> None:
        with sqlite3.connect(self.database_path) as connection:
            connection.executescript(SCHEMA_SQL)
            connection.execute(
                """
                INSERT OR REPLACE INTO project_sessions (
                  id, title, media_path, profile_id, settings_json, summary_json, session_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session.id,
                    session.title,
                    session.media_source.path,
                    session.profile_id,
                    self._to_json(session.settings),
                    self._to_json(
                        {
                            "status": session.status,
                            "analysis_coverage": self._convert(session.analysis_coverage),
                            "candidate_count": len(session.candidates),
                            "accepted_count": sum(
                                1 for decision in session.review_decisions if decision.action.value == "ACCEPT"
                            ),
                            "rejected_count": sum(
                                1 for decision in session.review_decisions if decision.action.value == "REJECT"
                            ),
                            "pending_count": max(
                                len(session.candidates)
                                - sum(1 for decision in session.review_decisions if decision.action.value == "ACCEPT")
                                - sum(1 for decision in session.review_decisions if decision.action.value == "REJECT"),
                                0,
                            ),
                        }
                    ),
                    self._to_json(session),
                    session.created_at,
                    session.updated_at,
                ),
            )

            connection.execute(
                "DELETE FROM candidate_windows WHERE project_session_id = ?",
                (session.id,),
            )
            for candidate in session.candidates:
                connection.execute(
                    """
                    INSERT INTO candidate_windows (
                      id, project_session_id, confidence_band, transcript_snippet,
                      candidate_window_json, suggested_segment_json, score_breakdown_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        candidate.id,
                        session.id,
                        candidate.confidence_band.value,
                        candidate.transcript_snippet,
                        self._to_json(candidate.candidate_window),
                        self._to_json(candidate.suggested_segment),
                        self._to_json(candidate.score_breakdown),
                    ),
                )

            connection.execute(
                """
                INSERT OR REPLACE INTO analysis_artifacts (
                  project_session_id, transcript_json, speech_regions_json, feature_windows_json
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    session.id,
                    self._to_json(session.transcript),
                    self._to_json(session.speech_regions),
                    self._to_json(session.feature_windows),
                ),
            )
            connection.commit()

    def save_review_decision(self, decision: ReviewDecision) -> None:
        with sqlite3.connect(self.database_path) as connection:
            connection.executescript(SCHEMA_SQL)
            connection.execute(
                """
                INSERT INTO review_decisions (
                  id, project_session_id, candidate_id, action,
                  label, adjusted_segment_json, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_session_id, candidate_id) DO UPDATE SET
                  id = excluded.id,
                  action = excluded.action,
                  label = excluded.label,
                  adjusted_segment_json = excluded.adjusted_segment_json,
                  notes = excluded.notes,
                  created_at = excluded.created_at
                """,
                (
                    decision.id,
                    decision.project_session_id,
                    decision.candidate_id,
                    decision.action.value,
                    decision.label,
                    self._to_json(decision.adjusted_segment) if decision.adjusted_segment else None,
                    decision.notes,
                    decision.created_at,
                ),
            )
            self._refresh_session_summary(connection, decision.project_session_id, decision.created_at)
            connection.commit()

    def count_candidates(self, project_session_id: str) -> int:
        with sqlite3.connect(self.database_path) as connection:
            result = connection.execute(
                "SELECT COUNT(*) FROM candidate_windows WHERE project_session_id = ?",
                (project_session_id,),
            ).fetchone()
        return int(result[0] if result else 0)

    def load_session(self, project_session_id: str) -> ProjectSession:
        with sqlite3.connect(self.database_path) as connection:
            connection.row_factory = sqlite3.Row
            connection.executescript(SCHEMA_SQL)
            self._ensure_column(connection, "project_sessions", "session_json", "TEXT")

            row = connection.execute(
                """
                SELECT id, title, media_path, profile_id, settings_json, summary_json, session_json, created_at, updated_at
                FROM project_sessions
                WHERE id = ?
                """,
                (project_session_id,),
            ).fetchone()
            if row is None:
                raise KeyError(f"Project session not found: {project_session_id}")

            session = self._load_base_session(row)
            session.review_decisions = self._load_review_decisions(connection, project_session_id)
            self._apply_review_state(session, row["updated_at"])
            return session

    def list_session_summaries(self) -> list[dict[str, Any]]:
        with sqlite3.connect(self.database_path) as connection:
            connection.row_factory = sqlite3.Row
            connection.executescript(SCHEMA_SQL)
            self._ensure_column(connection, "project_sessions", "session_json", "TEXT")

            rows = connection.execute(
                """
                SELECT
                  project_sessions.id AS session_id,
                  project_sessions.title AS session_title,
                  project_sessions.media_path AS source_path,
                  project_sessions.profile_id AS profile_id,
                  project_sessions.summary_json AS summary_json,
                  project_sessions.session_json AS session_json,
                  project_sessions.created_at AS created_at,
                  project_sessions.updated_at AS updated_at,
                  COALESCE(candidate_counts.candidate_count, 0) AS candidate_count,
                  COALESCE(accepted_counts.accepted_count, 0) AS accepted_count,
                  COALESCE(rejected_counts.rejected_count, 0) AS rejected_count
                FROM project_sessions
                LEFT JOIN (
                  SELECT project_session_id, COUNT(*) AS candidate_count
                  FROM candidate_windows
                  GROUP BY project_session_id
                ) AS candidate_counts
                  ON candidate_counts.project_session_id = project_sessions.id
                LEFT JOIN (
                  SELECT project_session_id, COUNT(*) AS accepted_count
                  FROM review_decisions
                  WHERE action = 'ACCEPT'
                  GROUP BY project_session_id
                ) AS accepted_counts
                  ON accepted_counts.project_session_id = project_sessions.id
                LEFT JOIN (
                  SELECT project_session_id, COUNT(*) AS rejected_count
                  FROM review_decisions
                  WHERE action = 'REJECT'
                  GROUP BY project_session_id
                ) AS rejected_counts
                  ON rejected_counts.project_session_id = project_sessions.id
                ORDER BY project_sessions.updated_at DESC
                """
            ).fetchall()

        summaries: list[dict[str, Any]] = []
        for row in rows:
            candidate_count = int(row["candidate_count"] or 0)
            accepted_count = int(row["accepted_count"] or 0)
            rejected_count = int(row["rejected_count"] or 0)
            source_path = row["source_path"]
            summaries.append(
                {
                    "session_id": row["session_id"],
                    "session_title": row["session_title"],
                    "source_path": source_path,
                    "source_name": Path(source_path).name if source_path else row["session_title"],
                    "status": self._status_from_summary_json(row["summary_json"]),
                    "analysis_coverage": self._analysis_coverage_summary_from_row(
                        row["summary_json"],
                        row["session_json"],
                    ),
                    "profile_id": row["profile_id"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "candidate_count": candidate_count,
                    "accepted_count": accepted_count,
                    "rejected_count": rejected_count,
                    "pending_count": max(candidate_count - accepted_count - rejected_count, 0),
                }
            )

        return summaries

    def _refresh_session_summary(
        self,
        connection: sqlite3.Connection,
        project_session_id: str,
        updated_at: str,
    ) -> None:
        candidate_count_row = connection.execute(
            "SELECT COUNT(*) FROM candidate_windows WHERE project_session_id = ?",
            (project_session_id,),
        ).fetchone()
        accepted_count_row = connection.execute(
            """
            SELECT COUNT(*) FROM review_decisions
            WHERE project_session_id = ? AND action = 'ACCEPT'
            """,
            (project_session_id,),
        ).fetchone()
        rejected_count_row = connection.execute(
            """
            SELECT COUNT(*) FROM review_decisions
            WHERE project_session_id = ? AND action = 'REJECT'
            """,
            (project_session_id,),
        ).fetchone()
        candidate_count = int(candidate_count_row[0] if candidate_count_row else 0)
        accepted_count = int(accepted_count_row[0] if accepted_count_row else 0)
        rejected_count = int(rejected_count_row[0] if rejected_count_row else 0)
        existing_summary_row = connection.execute(
            "SELECT summary_json, session_json FROM project_sessions WHERE id = ?",
            (project_session_id,),
        ).fetchone()
        existing_summary_json = existing_summary_row[0] if existing_summary_row else None
        existing_session_json = existing_summary_row[1] if existing_summary_row else None
        connection.execute(
            """
            UPDATE project_sessions
            SET summary_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                self._to_json(
                    {
                        "status": "REVIEWING",
                        "analysis_coverage": self._analysis_coverage_summary_from_row(
                            existing_summary_json,
                            existing_session_json,
                        ),
                        "candidate_count": candidate_count,
                        "accepted_count": accepted_count,
                        "rejected_count": rejected_count,
                        "pending_count": max(candidate_count - accepted_count - rejected_count, 0),
                    }
                ),
                updated_at,
                project_session_id,
            ),
        )

    def _load_base_session(self, row: sqlite3.Row) -> ProjectSession:
        session_json = row["session_json"]
        if session_json:
            session = self._project_session_from_dict(json.loads(session_json))
        else:
            session = analyze_media(
                row["media_path"],
                settings=self._settings_from_dict(json.loads(row["settings_json"])),
                profile_id=row["profile_id"],
                session_title=row["title"],
            )

        session.id = row["id"]
        session.title = row["title"]
        session.profile_id = row["profile_id"]
        session.created_at = row["created_at"]
        session.updated_at = row["updated_at"]
        return session

    def _load_review_decisions(
        self,
        connection: sqlite3.Connection,
        project_session_id: str,
    ) -> list[ReviewDecision]:
        rows = connection.execute(
            """
            SELECT id, project_session_id, candidate_id, action, label, adjusted_segment_json, notes, created_at
            FROM review_decisions
            WHERE project_session_id = ?
            ORDER BY created_at ASC
            """,
            (project_session_id,),
        ).fetchall()

        decisions: list[ReviewDecision] = []
        for row in rows:
            adjusted_segment = json.loads(row["adjusted_segment_json"]) if row["adjusted_segment_json"] else None
            decisions.append(
                ReviewDecision(
                    id=row["id"],
                    project_session_id=row["project_session_id"],
                    candidate_id=row["candidate_id"],
                    action=ReviewAction(row["action"]),
                    label=row["label"],
                    adjusted_segment=self._time_range_from_dict(adjusted_segment) if adjusted_segment else None,
                    notes=row["notes"],
                    created_at=row["created_at"],
                )
            )

        return decisions

    def _apply_review_state(
        self,
        session: ProjectSession,
        stored_updated_at: str,
    ) -> None:
        latest_updated_at = stored_updated_at
        decisions_by_candidate_id = {
            decision.candidate_id: decision for decision in session.review_decisions
        }

        for candidate in session.candidates:
            decision = decisions_by_candidate_id.get(candidate.id)
            if decision is None:
                continue

            if decision.label:
                candidate.editable_label = decision.label
            if decision.adjusted_segment:
                candidate.suggested_segment.start_seconds = (
                    decision.adjusted_segment.start_seconds
                )
                candidate.suggested_segment.end_seconds = (
                    decision.adjusted_segment.end_seconds
                )
            if decision.created_at > latest_updated_at:
                latest_updated_at = decision.created_at

        if session.review_decisions:
            session.status = "REVIEWING"
        session.updated_at = latest_updated_at

    def _project_session_from_dict(self, value: dict[str, Any]) -> ProjectSession:
        session = ProjectSession(
            id=value["id"],
            title=value["title"],
            status=value["status"],
            media_source=self._media_source_from_dict(value["media_source"]),
            profile_id=value["profile_id"],
            settings=self._settings_from_dict(value["settings"]),
            transcript=[
                self._transcript_chunk_from_dict(chunk)
                for chunk in value.get("transcript", [])
            ],
            speech_regions=[
                self._speech_region_from_dict(region)
                for region in value.get("speech_regions", [])
            ],
            feature_windows=[
                self._feature_window_from_dict(window)
                for window in value.get("feature_windows", [])
            ],
            candidates=[
                self._candidate_window_from_dict(candidate)
                for candidate in value.get("candidates", [])
            ],
            review_decisions=[
                self._review_decision_from_dict(decision)
                for decision in value.get("review_decisions", [])
            ],
            created_at=value["created_at"],
            updated_at=value["updated_at"],
            analysis_coverage=self._analysis_coverage_from_dict(
                value.get("analysis_coverage"),
            ),
        )
        if value.get("analysis_coverage") is None:
            session.analysis_coverage = self._derive_analysis_coverage(session)
        return session

    def _media_source_from_dict(self, value: dict[str, Any]) -> MediaSource:
        return MediaSource(
            id=value["id"],
            path=value["path"],
            kind=value["kind"],
            file_name=value["file_name"],
            duration_seconds=float(value["duration_seconds"]),
            format=value["format"],
            file_size_bytes=int(value.get("file_size_bytes", 0) or 0),
            frame_rate=float(value["frame_rate"]) if value.get("frame_rate") is not None else None,
            ingest_notes=list(value.get("ingest_notes", [])),
        )

    def _analysis_coverage_from_dict(
        self,
        value: dict[str, Any] | None,
    ) -> AnalysisCoverage:
        if not value:
            return AnalysisCoverage()

        try:
            band = AnalysisCoverageBand(
                value.get("band", AnalysisCoverageBand.PARTIAL.value)
            )
        except ValueError:
            band = AnalysisCoverageBand.PARTIAL

        flags: list[AnalysisCoverageFlag] = []
        for raw_flag in value.get("flags", []):
            try:
                flags.append(AnalysisCoverageFlag(raw_flag))
            except ValueError:
                continue

        return AnalysisCoverage(
            band=band,
            note=str(
                value.get("note", "Coverage note unavailable for this session.")
            ),
            flags=flags,
        )

    def _settings_from_dict(self, value: dict[str, Any]) -> Settings:
        return Settings(**value)

    def _transcript_chunk_from_dict(self, value: dict[str, Any]) -> TranscriptChunk:
        return TranscriptChunk(
            id=value["id"],
            start_seconds=float(value["start_seconds"]),
            end_seconds=float(value["end_seconds"]),
            text=value["text"],
            confidence=float(value["confidence"]) if value.get("confidence") is not None else None,
        )

    def _speech_region_from_dict(self, value: dict[str, Any]) -> SpeechRegion:
        return SpeechRegion(
            id=value["id"],
            start_seconds=float(value["start_seconds"]),
            end_seconds=float(value["end_seconds"]),
            speech_density=float(value["speech_density"]),
            overlap_activity=float(value["overlap_activity"]),
        )

    def _feature_window_from_dict(self, value: dict[str, Any]) -> FeatureWindow:
        return FeatureWindow(
            id=value["id"],
            start_seconds=float(value["start_seconds"]),
            end_seconds=float(value["end_seconds"]),
            rms_loudness=float(value["rms_loudness"]),
            onset_density=float(value["onset_density"]),
            spectral_contrast=float(value["spectral_contrast"]),
            zero_crossing_rate=float(value["zero_crossing_rate"]),
            speech_density=float(value["speech_density"]),
            overlap_activity=float(value["overlap_activity"]),
            laughter_like_burst=float(value["laughter_like_burst"]),
            pitch_excursion=float(value["pitch_excursion"]),
            abrupt_silence_after_intensity=float(value["abrupt_silence_after_intensity"]),
        )

    def _candidate_window_from_dict(self, value: dict[str, Any]) -> CandidateWindow:
        return CandidateWindow(
            id=value["id"],
            candidate_window=self._time_range_from_dict(value["candidate_window"]),
            suggested_segment=self._suggested_segment_from_dict(value["suggested_segment"]),
            confidence_band=ConfidenceBand(value["confidence_band"]),
            score_estimate=float(value["score_estimate"]),
            reason_codes=[
                ReasonCode(reason_code) for reason_code in value.get("reason_codes", [])
            ],
            transcript_snippet=value["transcript_snippet"],
            score_breakdown=[
                self._score_contribution_from_dict(item)
                for item in value.get("score_breakdown", [])
            ],
            context_required=bool(value.get("context_required", False)),
            editable_label=value["editable_label"],
            review_tags=[
                ReviewTag(review_tag) for review_tag in value.get("review_tags", [])
            ],
        )

    def _score_contribution_from_dict(self, value: dict[str, Any]) -> ScoreContribution:
        return ScoreContribution(
            reason_code=ReasonCode(value["reason_code"]),
            label=value["label"],
            contribution=float(value["contribution"]),
            direction=value["direction"],
        )

    def _suggested_segment_from_dict(self, value: dict[str, Any]) -> SuggestedSegment:
        return SuggestedSegment(
            start_seconds=float(value["start_seconds"]),
            end_seconds=float(value["end_seconds"]),
            setup_padding_seconds=float(value["setup_padding_seconds"]),
            resolution_padding_seconds=float(value["resolution_padding_seconds"]),
            trim_dead_air_applied=bool(value["trim_dead_air_applied"]),
        )

    def _review_decision_from_dict(self, value: dict[str, Any]) -> ReviewDecision:
        adjusted_segment = value.get("adjusted_segment")
        return ReviewDecision(
            id=value["id"],
            project_session_id=value["project_session_id"],
            candidate_id=value["candidate_id"],
            action=ReviewAction(value["action"]),
            label=value.get("label"),
            adjusted_segment=self._time_range_from_dict(adjusted_segment) if adjusted_segment else None,
            notes=value.get("notes"),
            created_at=value["created_at"],
        )

    def _time_range_from_dict(self, value: dict[str, Any]) -> TimeRange:
        return TimeRange(
            start_seconds=float(value["start_seconds"]),
            end_seconds=float(value["end_seconds"]),
        )

    def _status_from_summary_json(self, summary_json: str | None) -> str:
        if not summary_json:
            return "READY"

        try:
            payload = json.loads(summary_json)
        except json.JSONDecodeError:
            return "READY"

        status = payload.get("status")
        return status if isinstance(status, str) else "READY"

    def _analysis_coverage_summary_from_row(
        self,
        summary_json: str | None,
        session_json: str | None,
    ) -> dict[str, Any]:
        summary_payload: dict[str, Any] | None = None
        if summary_json:
            try:
                parsed_summary = json.loads(summary_json)
                if isinstance(parsed_summary, dict):
                    summary_payload = parsed_summary
            except json.JSONDecodeError:
                summary_payload = None

        summary_coverage = None
        if summary_payload:
            summary_coverage = summary_payload.get(
                "analysis_coverage",
                summary_payload.get("analysisCoverage"),
            )

        if isinstance(summary_coverage, dict):
            return self._convert(self._analysis_coverage_from_dict(summary_coverage))

        if session_json:
            try:
                parsed_session = json.loads(session_json)
                if isinstance(parsed_session, dict):
                    session = self._project_session_from_dict(parsed_session)
                    return self._convert(session.analysis_coverage)
            except json.JSONDecodeError:
                pass

        return self._convert(AnalysisCoverage())

    def _derive_analysis_coverage(self, session: ProjectSession) -> AnalysisCoverage:
        return build_analysis_coverage(
            session.media_source,
            session.transcript,
            session.candidates,
            session.settings,
        )

    def _ensure_column(
        self,
        connection: sqlite3.Connection,
        table_name: str,
        column_name: str,
        definition: str,
    ) -> None:
        existing_columns = {
            row[1]
            for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()
        }
        if column_name in existing_columns:
            return

        connection.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
        )

    def _to_json(self, value: Any) -> str:
        return json.dumps(self._convert(value), indent=2)

    def _convert(self, value: Any) -> Any:
        if isinstance(value, Enum):
            return value.value
        if is_dataclass(value):
            return {
                key: self._convert(inner_value)
                for key, inner_value in asdict(value).items()
            }
        if isinstance(value, dict):
            return {
                key: self._convert(inner_value)
                for key, inner_value in value.items()
            }
        if isinstance(value, list):
            return [self._convert(item) for item in value]
        return value
