import type {
  ProjectSession,
  ReviewDecision,
} from "@highlightsmith/shared-types";

export const sqliteSchemaVersion = 1;

export const sqliteTables = [
  "project_sessions",
  "candidate_windows",
  "review_decisions",
  "analysis_artifacts",
] as const;

export const initialMigrationSql = `
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
`;

export interface SessionStorageAdapter {
  saveSession(session: ProjectSession): Promise<void>;
  saveReviewDecision(decision: ReviewDecision): Promise<void>;
}

export function serializeSessionSnapshot(
  session: ProjectSession,
): Record<string, string> {
  return {
    id: session.id,
    title: session.title,
    mediaPath: session.mediaSource.path,
    profileId: session.profileId,
    settingsJson: JSON.stringify(session.settings),
    summaryJson: JSON.stringify({
      status: session.status,
      candidateCount: session.candidates.length,
      acceptedCount: session.reviewDecisions.filter(
        (decision) => decision.action === "ACCEPT",
      ).length,
    }),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function serializeReviewDecision(
  decision: ReviewDecision,
): Record<string, string | null> {
  return {
    id: decision.id,
    projectSessionId: decision.projectSessionId,
    candidateId: decision.candidateId,
    action: decision.action,
    label: decision.label ?? null,
    adjustedSegmentJson: decision.adjustedSegment
      ? JSON.stringify(decision.adjustedSegment)
      : null,
    notes: decision.notes ?? null,
    createdAt: decision.createdAt,
  };
}

export const migrationPlaceholders = [
  "001_initial_schema.sql",
  "002_review_feedback_indexes.sql",
  "003_profile_preferences.sql",
] as const;
