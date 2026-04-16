import type {
  CandidateWindow,
  ReviewDecision,
} from "@highlightsmith/shared-types";
import { describeCandidatePlainly } from "@highlightsmith/domain";
import { formatLongTime } from "../lib/format";
import {
  candidateHasReviewRisk,
  formatReviewTagLabel,
  primaryReviewTag,
} from "../lib/reviewTags";

type CandidateTimelineProps = {
  durationSeconds: number;
  candidates: CandidateWindow[];
  selectedCandidateId: string | null;
  decisionsByCandidateId: Record<string, ReviewDecision>;
  onSelectCandidate: (candidateId: string) => void;
};

type TimelineLaneMarker = {
  candidate: CandidateWindow;
  lane: number;
};

export function CandidateTimeline({
  durationSeconds,
  candidates,
  selectedCandidateId,
  decisionsByCandidateId,
  onSelectCandidate,
}: CandidateTimelineProps) {
  if (candidates.length === 0) {
    return (
      <section className="timeline-panel glass-panel empty-state">
        <p className="eyebrow">Session markers</p>
        <h2>No candidates found</h2>
        <p>Analysis returned no strong signals for this session.</p>
      </section>
    );
  }

  const selectedCandidate =
    candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    candidates[0];
  const laneMarkers = assignTimelineLanes(candidates);
  const laneCount =
    laneMarkers.reduce((maxLane, marker) => Math.max(maxLane, marker.lane), 0) + 1;
  const demotedCount = candidates.filter(candidateHasReviewRisk).length;
  const selectedCandidateDescription = describeCandidatePlainly(selectedCandidate);

  return (
    <section className="timeline-panel glass-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Session markers</p>
          <h2>Candidate timeline</h2>
          <p className="timeline-summary-copy">
            {candidates.length} markers across {formatLongTime(durationSeconds)} •{" "}
            {demotedCount} flagged for closer review
          </p>
        </div>
        <span className="queue-count">{laneCount} lanes</span>
      </div>

      <div className="timeline-ruler">
        <span>00:00:00</span>
        <span>{formatLongTime(durationSeconds / 2)}</span>
        <span>{formatLongTime(durationSeconds)}</span>
      </div>

      <div
        className="timeline-track"
        style={{
          height: `${Math.max(laneCount * 28, 72)}px`,
        }}
      >
        {laneMarkers.map(({ candidate, lane }) => {
          const decision = decisionsByCandidateId[candidate.id];
          const markerLeft = percentageOf(
            candidate.candidateWindow.startSeconds,
            durationSeconds,
          );
          const markerWidth = Math.max(
            percentageOf(
              candidate.candidateWindow.endSeconds -
                candidate.candidateWindow.startSeconds,
              durationSeconds,
            ),
            1.4,
          );
          const suggestedLeft = percentageOf(
            candidate.suggestedSegment.startSeconds -
              candidate.candidateWindow.startSeconds,
            candidate.candidateWindow.endSeconds -
              candidate.candidateWindow.startSeconds,
          );
          const suggestedWidth = Math.max(
            percentageOf(
              candidate.suggestedSegment.endSeconds -
                candidate.suggestedSegment.startSeconds,
              candidate.candidateWindow.endSeconds -
                candidate.candidateWindow.startSeconds,
            ),
            18,
          );
          const reviewTag = primaryReviewTag(candidate);
          const plainDescription = describeCandidatePlainly(candidate);

          return (
            <button
              aria-label={`Focus ${plainDescription.summary}`}
              className={buildTimelineMarkerClassName(
                candidate,
                decision,
                candidate.id === selectedCandidate.id,
              )}
              key={candidate.id}
              onClick={() => onSelectCandidate(candidate.id)}
              style={{
                left: `${markerLeft}%`,
                top: `${lane * 28 + 8}px`,
                width: `${markerWidth}%`,
              }}
              title={`${plainDescription.summary} • ${formatLongTime(candidate.candidateWindow.startSeconds)} to ${formatLongTime(candidate.candidateWindow.endSeconds)}`}
              type="button"
            >
              <span
                className="timeline-marker-segment"
                style={{
                  left: `${Math.max(suggestedLeft, 0)}%`,
                  width: `${Math.min(suggestedWidth, 100)}%`,
                }}
              />
              {reviewTag ? (
                <span className="timeline-marker-tag">
                  {formatReviewTagLabel(reviewTag)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <article className="timeline-focus-card">
        <div className="section-title-row">
          <h3>{selectedCandidate.editableLabel}</h3>
          <span className="decision-pill">
            {decisionsByCandidateId[selectedCandidate.id]?.action ?? "PENDING"}
          </span>
        </div>
        <p className="timeline-focus-copy">
          {selectedCandidateDescription.summary}
        </p>
        {selectedCandidateDescription.detail ? (
          <p className="timeline-focus-copy">
            {selectedCandidateDescription.detail}
          </p>
        ) : null}
        <p>
          Window {formatLongTime(selectedCandidate.candidateWindow.startSeconds)} to{" "}
          {formatLongTime(selectedCandidate.candidateWindow.endSeconds)}
        </p>
        <p>
          Suggested segment {formatLongTime(selectedCandidate.suggestedSegment.startSeconds)} to{" "}
          {formatLongTime(selectedCandidate.suggestedSegment.endSeconds)}
        </p>
        {selectedCandidate.reviewTags.length > 0 ? (
          <div className="review-tag-row">
            {selectedCandidate.reviewTags.map((reviewTag) => (
              <span className="review-tag-pill" key={reviewTag}>
                {formatReviewTagLabel(reviewTag)}
              </span>
            ))}
          </div>
        ) : (
          <p className="timeline-focus-copy">
            No manual-review flags on this candidate.
          </p>
        )}
      </article>
    </section>
  );
}

function assignTimelineLanes(candidates: CandidateWindow[]): TimelineLaneMarker[] {
  const sortedCandidates = [...candidates].sort(
    (left, right) =>
      left.candidateWindow.startSeconds - right.candidateWindow.startSeconds,
  );
  const laneEnds: number[] = [];

  return sortedCandidates.map((candidate) => {
    let laneIndex = laneEnds.findIndex(
      (laneEnd) => laneEnd <= candidate.candidateWindow.startSeconds,
    );

    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(candidate.candidateWindow.endSeconds);
    } else {
      laneEnds[laneIndex] = candidate.candidateWindow.endSeconds;
    }

    return {
      candidate,
      lane: laneIndex,
    };
  });
}

function buildTimelineMarkerClassName(
  candidate: CandidateWindow,
  decision: ReviewDecision | undefined,
  isSelected: boolean,
): string {
  return [
    "timeline-marker",
    candidate.confidenceBand.toLowerCase(),
    candidateHasReviewRisk(candidate) ? "demoted" : "",
    decision?.action === "ACCEPT" ? "accepted" : "",
    decision?.action === "REJECT" ? "rejected" : "",
    isSelected ? "selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function percentageOf(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return (value / total) * 100;
}
