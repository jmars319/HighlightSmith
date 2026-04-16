import type {
  ContentProfile,
  ProfileMatchingSummary,
  ProjectSession,
} from "@highlightsmith/shared-types";
import {
  analysisCoverageTone,
  formatAnalysisCoverageBand,
  formatAnalysisCoverageFlag,
  summarizeSessionQuality,
} from "@highlightsmith/domain";
import { formatLongTime } from "../lib/format";

type SessionOverviewProps = {
  session: ProjectSession;
  profile: ContentProfile;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  selectedCandidateIndex: number;
  reviewStateLabel: string;
  reviewStateTone: "PENDING" | "IN_PROGRESS" | "REVIEWED";
  profileMatchingSummary: ProfileMatchingSummary;
};

export function SessionOverview({
  session,
  profile,
  acceptedCount,
  rejectedCount,
  pendingCount,
  selectedCandidateIndex,
  reviewStateLabel,
  reviewStateTone,
  profileMatchingSummary,
}: SessionOverviewProps) {
  const candidateCount = session.candidates.length;
  const sessionQualitySummary = summarizeSessionQuality(
    session.analysisCoverage,
    candidateCount,
  );
  const selectedCandidateCopy =
    candidateCount === 0
      ? "No candidates found"
      : selectedCandidateIndex >= 0
        ? `Candidate ${selectedCandidateIndex + 1} selected`
        : "Review queue ready";

  return (
    <section className="session-overview-panel glass-panel">
      <div className="session-overview-header">
        <div>
          <p className="eyebrow">Analysis output</p>
          <h2>{session.title}</h2>
          <p className="session-overview-copy">
            Local session for {session.mediaSource.fileName}. HighlightSmith
            returned {candidateCount} candidate
            {candidateCount === 1 ? "" : "s"} for review.
          </p>
        </div>
        <div className="session-overview-badges">
          <span
            className={`session-state-pill ${reviewStateTone.toLowerCase().replace("_", "-")}`}
          >
            {reviewStateLabel}
          </span>
          <span className="session-state-pill active-session">
            {formatLifecycleStatus(session.status)}
          </span>
        </div>
      </div>

      <div className="session-overview-grid">
        <article className="session-overview-card">
          <span className="detail-label">Source recording</span>
          <strong>{session.mediaSource.fileName}</strong>
          <p className="session-overview-path">{session.mediaSource.path}</p>
          <p>
            {formatLongTime(session.mediaSource.durationSeconds)} •{" "}
            {session.mediaSource.kind.toLowerCase()} •{" "}
            {session.mediaSource.format}
          </p>
        </article>

        <article className="session-overview-card">
          <span className="detail-label">Profile</span>
          <strong>{profile.name}</strong>
          <p>{profile.description}</p>
          <p>{profileMatchingSummary.note}</p>
          <p>
            {profileMatchingSummary.usableLocalExampleCount} usable local
            example
            {profileMatchingSummary.usableLocalExampleCount === 1
              ? ""
              : "s"} • {profileMatchingSummary.referenceOnlyExampleCount}{" "}
            reference-only
          </p>
        </article>

        <article className="session-overview-card">
          <span className="detail-label">Analyzed</span>
          <strong>{formatTimestamp(session.createdAt)}</strong>
          <p>Updated {formatTimestamp(session.updatedAt)}</p>
        </article>

        <article
          className={`session-overview-card coverage ${analysisCoverageTone(session.analysisCoverage)}`}
        >
          <div className="section-title-row">
            <span className="detail-label">Analysis coverage</span>
            <span
              className={`analysis-coverage-pill ${analysisCoverageTone(session.analysisCoverage)}`}
            >
              {formatAnalysisCoverageBand(session.analysisCoverage.band)}
            </span>
          </div>
          <strong>{sessionQualitySummary}</strong>
          <p>{session.analysisCoverage.note}</p>
          {session.analysisCoverage.flags.length > 0 ? (
            <div className="analysis-coverage-flag-row">
              {session.analysisCoverage.flags.map((flag) => (
                <span className="analysis-coverage-flag" key={flag}>
                  {formatAnalysisCoverageFlag(flag)}
                </span>
              ))}
            </div>
          ) : null}
        </article>

        <article className="session-overview-card">
          <span className="detail-label">Candidate output</span>
          <strong>
            {candidateCount} candidate{candidateCount === 1 ? "" : "s"}
          </strong>
          <p>
            {candidateCount === 0
              ? "Analysis returned no strong signals for this session."
              : `${pendingCount} pending • ${acceptedCount} accepted • ${rejectedCount} rejected`}
          </p>
        </article>

        <article className="session-overview-card">
          <span className="detail-label">Current focus</span>
          <strong>{selectedCandidateCopy}</strong>
          <p>
            {pendingCount === 0
              ? "This session is fully reviewed."
              : `${pendingCount} candidate${pendingCount === 1 ? "" : "s"} still need decisions.`}
          </p>
        </article>
      </div>

      {session.mediaSource.ingestNotes.length > 0 ? (
        <article className="session-overview-alert">
          <span className="detail-label">Ingest notes</span>
          <ul className="plain-list session-overview-note-list">
            {session.mediaSource.ingestNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
      ) : null}

      {candidateCount === 0 ? (
        <article className="session-overview-alert empty">
          <span className="detail-label">Sparse output</span>
          <p>
            No candidates found. Review the ingest notes, confirm the input
            file, or rerun with a different profile.
          </p>
        </article>
      ) : null}
    </section>
  );
}

function formatLifecycleStatus(status: ProjectSession["status"]): string {
  if (status === "REVIEWING") {
    return "Reviewing";
  }

  if (status === "ANALYZING") {
    return "Analyzing";
  }

  if (status === "READY") {
    return "Ready";
  }

  return "Idle";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
