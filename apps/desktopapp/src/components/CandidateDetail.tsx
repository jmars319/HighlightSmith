import type {
  CandidateWindow,
  ContentProfile,
  ReviewDecision,
} from "@highlightsmith/shared-types";
import {
  ConfidenceBadge,
  ReviewControls,
  TranscriptSnippetBlock,
} from "@highlightsmith/ui";
import { reasonCodeLabel, summarizeCandidate } from "@highlightsmith/scoring";
import { formatLongTime, percentage } from "../lib/format";

type CandidateDetailProps = {
  candidate: CandidateWindow | null;
  decision: ReviewDecision | undefined;
  profile: ContentProfile;
  exportPreview: string;
  onAccept: () => void;
  onReject: () => void;
  onExpandSetup: () => void;
  onExpandResolution: () => void;
  onLabelChange: (value: string) => void;
  labelDraft: string;
  onSaveLabel: () => void;
};

export function CandidateDetail({
  candidate,
  decision,
  profile,
  exportPreview,
  onAccept,
  onReject,
  onExpandSetup,
  onExpandResolution,
  onLabelChange,
  labelDraft,
  onSaveLabel,
}: CandidateDetailProps) {
  if (!candidate) {
    return (
      <section className="detail-panel glass-panel empty-state">
        <p className="eyebrow">Candidate detail</p>
        <h2>No candidate selected</h2>
        <p>
          Select a candidate window to inspect its reasons and suggested clip
          boundaries.
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
        </div>
        <ConfidenceBadge band={candidate.confidenceBand} />
      </div>

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

      <section className="review-panel">
        <div className="section-title-row">
          <h3>Review actions</h3>
          <span className="decision-pill">{decision?.action ?? "PENDING"}</span>
        </div>

        <ReviewControls
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
            onClick={onExpandResolution}
            type="button"
          >
            Add 2s resolution
          </button>
        </div>
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
