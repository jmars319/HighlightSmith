import type {
  CandidateWindow,
  ContentProfile,
  ReviewDecision,
} from "@highlightsmith/shared";
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
        <p>Select a candidate window to inspect its reasons and suggested clip boundaries.</p>
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
        <span className={`band-pill ${candidate.confidenceBand.toLowerCase()}`}>
          {candidate.confidenceBand}
        </span>
      </div>

      <div className="detail-grid">
        <article className="detail-card">
          <span className="detail-label">Window</span>
          <strong>
            {formatLongTime(candidate.candidateWindow.startSeconds)} to{" "}
            {formatLongTime(candidate.candidateWindow.endSeconds)}
          </strong>
          <p>{candidate.transcriptSnippet}</p>
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
          <span className="score-pill">{percentage(candidate.scoreEstimate)}</span>
        </div>

        <div className="breakdown-list">
          {candidate.scoreBreakdown.map((item) => (
            <article className="breakdown-item" key={`${candidate.id}-${item.reasonCode}`}>
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
                  style={{ width: `${Math.min(Math.abs(item.contribution) * 100, 100)}%` }}
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

        <div className="action-row">
          <button className="button-primary" onClick={onAccept} type="button">
            Accept
          </button>
          <button className="button-danger" onClick={onReject} type="button">
            Reject
          </button>
          <button className="button-secondary" onClick={onExpandSetup} type="button">
            Add 2s setup
          </button>
          <button className="button-secondary" onClick={onExpandResolution} type="button">
            Add 2s resolution
          </button>
        </div>

        <label className="label-editor">
          <span className="input-label">Editable label</span>
          <div className="label-editor-row">
            <input
              onChange={(event) => onLabelChange(event.target.value)}
              type="text"
              value={labelDraft}
            />
            <button className="button-secondary" onClick={onSaveLabel} type="button">
              Save label
            </button>
          </div>
        </label>
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
