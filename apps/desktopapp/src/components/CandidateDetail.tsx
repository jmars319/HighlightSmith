import type {
  CandidateWindow,
  ContentProfile,
  ProjectSessionSummary,
  ReviewDecision,
  TranscriptChunk,
} from "@highlightsmith/shared-types";
import type { ReviewQueueMode } from "@highlightsmith/domain";
import {
  ConfidenceBadge,
  ReviewControls,
  TranscriptSnippetBlock,
} from "@highlightsmith/ui";
import { reasonCodeLabel, summarizeCandidate } from "@highlightsmith/scoring";
import { formatLongTime, percentage } from "../lib/format";
import { formatReviewTagLabel } from "../lib/reviewTags";
import { TranscriptContextPeek } from "./TranscriptContextPeek";

type CandidateDetailProps = {
  candidate: CandidateWindow | null;
  decision: ReviewDecision | undefined;
  profile: ContentProfile;
  transcript: TranscriptChunk[];
  exportPreview: string;
  candidateIndex: number;
  candidateCount: number;
  pendingCount: number;
  nextPendingSession: ProjectSessionSummary | null;
  reviewQueueMode: ReviewQueueMode;
  selectedCandidateVisibleInQueue: boolean;
  visibleCandidateCount: number;
  onAccept: () => void;
  onReject: () => void;
  onExpandSetup: () => void;
  onExpandResolution: () => void;
  onOpenNextPendingSession: () => void;
  onSelectPreviousVisible: () => void;
  onSelectNextVisible: () => void;
  onSelectNextPending: () => void;
  onLabelChange: (value: string) => void;
  labelDraft: string;
  onSaveLabel: () => void;
  onReturnToProjects: () => void;
  isSavingReview: boolean;
  reviewError: string | null;
};

export function CandidateDetail({
  candidate,
  decision,
  profile,
  transcript,
  exportPreview,
  candidateIndex,
  candidateCount,
  pendingCount,
  nextPendingSession,
  reviewQueueMode,
  selectedCandidateVisibleInQueue,
  visibleCandidateCount,
  onAccept,
  onReject,
  onExpandSetup,
  onExpandResolution,
  onOpenNextPendingSession,
  onSelectPreviousVisible,
  onSelectNextVisible,
  onSelectNextPending,
  onLabelChange,
  labelDraft,
  onSaveLabel,
  onReturnToProjects,
  isSavingReview,
  reviewError,
}: CandidateDetailProps) {
  if (!candidate) {
    return (
      <section className="detail-panel glass-panel empty-state">
        <p className="eyebrow">Candidate detail</p>
        <h2>
          {candidateCount === 0
            ? "No candidate windows returned"
            : "No candidate selected"}
        </h2>
        <p>
          {candidateCount === 0
            ? "This session finished analysis without candidate windows. Review the session summary and ingest notes, then rerun if needed."
            : "Select a candidate window to inspect its reasons and suggested clip boundaries."}
        </p>
      </section>
    );
  }

  const activeSegment = decision?.adjustedSegment ?? candidate.suggestedSegment;

  return (
    <section className="detail-panel glass-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Candidate detail</p>
          <h2>{decision?.label ?? candidate.editableLabel}</h2>
          <p className="detail-progress-copy">
            Candidate {candidateIndex + 1} of {candidateCount} • {pendingCount} pending
          </p>
          <p className="detail-mode-copy">
            Queue mode: {reviewQueueMode === "ONLY_PENDING" ? "Only pending" : "All candidates"}
            {!selectedCandidateVisibleInQueue
              ? " • current selection is outside the queue view"
              : ""}
          </p>
        </div>
        <div className="detail-header-meta">
          <span className="decision-pill">{decision?.action ?? "PENDING"}</span>
          <ConfidenceBadge band={candidate.confidenceBand} />
        </div>
      </div>

      {candidate.reviewTags.length > 0 ? (
        <div className="review-tag-row">
          {candidate.reviewTags.map((reviewTag) => (
            <span className="review-tag-pill" key={reviewTag}>
              {formatReviewTagLabel(reviewTag)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="detail-grid">
        <article className="detail-card">
          <span className="detail-label">Window</span>
          <strong>
            {formatLongTime(candidate.candidateWindow.startSeconds)} to{" "}
            {formatLongTime(candidate.candidateWindow.endSeconds)}
          </strong>
          <TranscriptSnippetBlock
            heading="Transcript snippet"
            text={candidate.transcriptSnippet}
          />
        </article>

        <article className="detail-card">
          <span className="detail-label">Suggested segment</span>
          <strong>
            {formatLongTime(activeSegment.startSeconds)} to{" "}
            {formatLongTime(activeSegment.endSeconds)}
          </strong>
          <p>
            Setup {candidate.suggestedSegment.setupPaddingSeconds}s • Resolution{" "}
            {candidate.suggestedSegment.resolutionPaddingSeconds}s
          </p>
        </article>

        <article className="detail-card">
          <span className="detail-label">Narrative summary</span>
          <strong>{summarizeCandidate(candidate, profile)}</strong>
          <p>
            {candidate.contextRequired
              ? "Requires surrounding context to confirm clip value."
              : "Signals align cleanly enough to review as a likely standalone moment."}
          </p>
        </article>
      </div>

      <TranscriptContextPeek candidate={candidate} transcript={transcript} />

      <section className="breakdown-panel">
        <div className="section-title-row">
          <h3>Score breakdown</h3>
          <span className="score-pill">
            {percentage(candidate.scoreEstimate)}
          </span>
        </div>

        <div className="breakdown-list">
          {candidate.scoreBreakdown.map((item) => (
            <article
              className="breakdown-item"
              key={`${candidate.id}-${item.reasonCode}`}
            >
              <div className="breakdown-copy">
                <strong>{item.label}</strong>
                <span>{reasonCodeLabel(item.reasonCode)}</span>
              </div>
              <div className="breakdown-meter">
                <div
                  className={
                    item.direction === "NEGATIVE"
                      ? "breakdown-fill negative"
                      : "breakdown-fill"
                  }
                  style={{
                    width: `${Math.min(Math.abs(item.contribution) * 100, 100)}%`,
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {pendingCount === 0 ? (
        <section className="completion-panel">
          <div className="section-title-row">
            <h3>Session review complete</h3>
            <span className="session-state-pill reviewed">Complete</span>
          </div>
          <p className="review-status-copy">
            Every candidate in this session now has a decision.
          </p>
          <div className="action-row">
            {nextPendingSession ? (
              <button
                className="button-primary"
                onClick={onOpenNextPendingSession}
                type="button"
              >
                Open next pending session
              </button>
            ) : null}
            <button
              className="button-secondary"
              onClick={onReturnToProjects}
              type="button"
            >
              Back to projects
            </button>
          </div>
          <p className="review-status-copy">
            {nextPendingSession
              ? `${nextPendingSession.sessionTitle} • ${nextPendingSession.pendingCount} pending`
              : "All persisted backlog sessions are currently fully reviewed."}
          </p>
        </section>
      ) : null}

      <section className="review-panel">
        <div className="section-title-row">
          <h3>Review actions</h3>
          <span className="review-status-copy">
            {decision?.action === "ACCEPT"
              ? "Accepted for follow-up"
              : decision?.action === "REJECT"
                ? "Rejected for now"
                : "Still pending review"}
          </span>
        </div>

        <ReviewControls
          disabled={isSavingReview}
          labelDraft={labelDraft}
          onAccept={onAccept}
          onLabelChange={onLabelChange}
          onReject={onReject}
          onRelabel={onSaveLabel}
          onRetime={onExpandSetup}
        />

        <div className="action-row">
          <button
            className="button-secondary"
            disabled={visibleCandidateCount === 0}
            onClick={onSelectPreviousVisible}
            type="button"
          >
            Previous in queue
          </button>
          <button
            className="button-secondary"
            disabled={visibleCandidateCount === 0}
            onClick={onSelectNextVisible}
            type="button"
          >
            Next in queue
          </button>
          {pendingCount > 0 ? (
            <button
              className="button-secondary"
              onClick={onReturnToProjects}
              type="button"
            >
              Back to projects
            </button>
          ) : null}
          <button
            className="button-secondary"
            disabled={isSavingReview || pendingCount === 0}
            onClick={onSelectNextPending}
            type="button"
          >
            Jump to next pending
          </button>
          <button
            className="button-secondary"
            disabled={isSavingReview}
            onClick={onExpandResolution}
            type="button"
          >
            Add 2s resolution
          </button>
        </div>

        {isSavingReview ? (
          <p className="review-status">Saving review update...</p>
        ) : null}
        {reviewError ? <p className="review-error">{reviewError}</p> : null}
      </section>

      <section className="export-panel">
        <div className="section-title-row">
          <h3>Export preview</h3>
          <span className="eyebrow">Accepted + pending candidates</span>
        </div>
        <pre>{exportPreview || "No accepted candidates yet."}</pre>
      </section>
    </section>
  );
}
