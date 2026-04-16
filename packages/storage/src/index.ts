import type {
  ProjectSession,
  ReviewDecision,
} from "@highlightsmith/shared-types";

export const sqliteSchemaVersion = 2;

export const sqliteTables = [
  "project_sessions",
  "candidate_windows",
  "review_decisions",
  "analysis_artifacts",
  "clip_profiles",
  "example_clips",
] as const;

export const initialMigrationSql = `
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

CREATE TABLE IF NOT EXISTS clip_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  state TEXT NOT NULL,
  source TEXT NOT NULL,
  mode TEXT NOT NULL,
  signal_weights_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS example_clips (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_value TEXT NOT NULL,
  title TEXT,
  note TEXT,
  status TEXT NOT NULL,
  status_detail TEXT,
  summary_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES clip_profiles(id)
);
`;

export interface SessionStorageAdapter {
  saveSession(session: ProjectSession): Promise<void>;
  saveReviewDecision(decision: ReviewDecision): Promise<void>;
}

export function serializeSessionSnapshot(
  session: ProjectSession,
): Record<string, string> {
  const acceptedCount = session.reviewDecisions.filter(
    (decision) => decision.action === "ACCEPT",
  ).length;
  const rejectedCount = session.reviewDecisions.filter(
    (decision) => decision.action === "REJECT",
  ).length;

  return {
    id: session.id,
    title: session.title,
    mediaPath: session.mediaSource.path,
    profileId: session.profileId,
    settingsJson: JSON.stringify(session.settings),
    summaryJson: JSON.stringify({
      status: session.status,
      analysisCoverage: session.analysisCoverage,
      candidateCount: session.candidates.length,
      acceptedCount,
      rejectedCount,
      pendingCount: Math.max(
        session.candidates.length - acceptedCount - rejectedCount,
        0,
      ),
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
  "004_clip_profiles.sql",
] as const;
