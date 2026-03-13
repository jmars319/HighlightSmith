from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, is_dataclass
from enum import Enum
from pathlib import Path
from typing import Any

from ..contracts import ProjectSession, ReviewDecision

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS project_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  media_path TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  summary_json TEXT NOT NULL,
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
"""


class SessionStore:
    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.database_path) as connection:
            connection.executescript(SCHEMA_SQL)
            connection.commit()

    def save_session(self, session: ProjectSession) -> None:
        with sqlite3.connect(self.database_path) as connection:
            connection.executescript(SCHEMA_SQL)
            connection.execute(
                """
                INSERT OR REPLACE INTO project_sessions (
                  id, title, media_path, profile_id, settings_json, summary_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
                            "candidate_count": len(session.candidates),
                            "accepted_count": sum(
                                1 for decision in session.review_decisions if decision.action.value == "ACCEPT"
                            ),
                        }
                    ),
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
                INSERT OR REPLACE INTO review_decisions (
                  id, project_session_id, candidate_id, action,
                  label, adjusted_segment_json, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
            connection.commit()

    def count_candidates(self, project_session_id: str) -> int:
        with sqlite3.connect(self.database_path) as connection:
            result = connection.execute(
                "SELECT COUNT(*) FROM candidate_windows WHERE project_session_id = ?",
                (project_session_id,),
            ).fetchone()
        return int(result[0] if result else 0)

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
