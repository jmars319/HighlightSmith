import type {
  CandidateWindow,
  ConfidenceBand,
  ReviewDecision,
  ContentProfile,
} from "@highlightsmith/shared-types";
import {
  resolveCandidateLabel,
  type ReviewQueueMode,
} from "@highlightsmith/domain";
import { summarizeCandidate } from "@highlightsmith/scoring";
import { CandidateCard } from "@highlightsmith/ui";
import { formatSeconds, percentage } from "../lib/format";
import {
  candidateHasReviewRisk,
  formatReviewTagLabel,
  primaryReviewTag,
} from "../lib/reviewTags";

type CandidateQueueProps = {
  candidates: CandidateWindow[];
  selectedCandidateId: string | null;
  decisionsByCandidateId: Record<string, ReviewDecision>;
  profile: ContentProfile;
  pendingCount: number;
  reviewedCount: number;
  totalCandidateCount: number;
  matchingCandidateCount: number;
  searchValue: string;
  deferredSearchValue: string;
  onSearchChange: (value: string) => void;
  bandFilter: ConfidenceBand | "ALL";
  onBandFilterChange: (value: ConfidenceBand | "ALL") => void;
  reviewQueueMode: ReviewQueueMode;
  onReviewQueueModeChange: (value: ReviewQueueMode) => void;
  selectedCandidateVisibleInQueue: boolean;
  onSelectCandidate: (candidateId: string) => void;
  onSelectNextPending: () => void;
};

const filters: Array<ConfidenceBand | "ALL"> = [
  "ALL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "EXPERIMENTAL",
];

export function CandidateQueue({
  candidates,
  selectedCandidateId,
  decisionsByCandidateId,
  profile,
  pendingCount,
  reviewedCount,
  totalCandidateCount,
  matchingCandidateCount,
  searchValue,
  deferredSearchValue,
  onSearchChange,
  bandFilter,
  onBandFilterChange,
  reviewQueueMode,
  onReviewQueueModeChange,
  selectedCandidateVisibleInQueue,
  onSelectCandidate,
  onSelectNextPending,
}: CandidateQueueProps) {
  const hiddenReviewedCount =
    reviewQueueMode === "ONLY_PENDING"
      ? Math.max(matchingCandidateCount - candidates.length, 0)
      : 0;

  return (
    <section className="queue-panel glass-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Review queue</p>
          <h2>Candidate windows</h2>
          <p className="queue-summary-copy">
            {reviewQueueMode === "ONLY_PENDING"
              ? `${candidates.length} pending in queue • ${hiddenReviewedCount} reviewed hidden`
              : `${pendingCount} pending • ${reviewedCount} reviewed`}
          </p>
        </div>
        <div className="queue-tools">
          <span className="queue-count">
            {candidates.length} visible of {totalCandidateCount}
          </span>
          <button
            className="button-secondary queue-action"
            disabled={pendingCount === 0}
            onClick={onSelectNextPending}
            type="button"
          >
            Next pending
          </button>
        </div>
      </div>

      <label className="search-block">
        <span className="input-label">Search transcript / labels</span>
        <input
          aria-label="Search candidate transcripts"
          className="search-input"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search phrases, labels, or reason codes"
          type="search"
          value={searchValue}
        />
        <small>Deferred query: {deferredSearchValue || "none"}</small>
      </label>

      <div className="filter-row">
        <button
          className={
            reviewQueueMode === "ONLY_PENDING"
              ? "filter-chip active"
              : "filter-chip"
          }
          disabled={pendingCount === 0}
          onClick={() => onReviewQueueModeChange("ONLY_PENDING")}
          type="button"
        >
          Only pending ({pendingCount})
        </button>
        <button
          className={
            reviewQueueMode === "ALL" ? "filter-chip active" : "filter-chip"
          }
          onClick={() => onReviewQueueModeChange("ALL")}
          type="button"
        >
          All ({totalCandidateCount})
        </button>
      </div>

      <div className="filter-row">
        {filters.map((filterValue) => (
          <button
            key={filterValue}
            className={
              filterValue === bandFilter ? "filter-chip active" : "filter-chip"
            }
            onClick={() => onBandFilterChange(filterValue)}
            type="button"
          >
            {filterValue}
          </button>
        ))}
      </div>

      {!selectedCandidateVisibleInQueue ? (
        <p className="queue-summary-copy">
          The current selection is outside this queue view. Timeline and detail stay
          focused until you choose another candidate.
        </p>
      ) : null}

      {candidates.length === 0 ? (
        <article className="queue-empty-state">
          <span className="detail-label">Queue state</span>
          <p>
            {totalCandidateCount === 0
              ? "This session did not return any candidate windows yet. Review the session summary, then rerun analysis if needed."
              : reviewQueueMode === "ONLY_PENDING"
              ? "No pending candidates match the current search and confidence filters."
              : "No candidates match the current search and confidence filters."}
          </p>
        </article>
      ) : (
        <div className="candidate-list">
          {candidates.map((candidate, index) => {
            const decision = decisionsByCandidateId[candidate.id];
            const isSelected = candidate.id === selectedCandidateId;
            const reviewTag = primaryReviewTag(candidate);

            return (
              <div
                className={
                  candidateHasReviewRisk(candidate)
                    ? "candidate-list-item demoted"
                    : "candidate-list-item"
                }
                key={candidate.id}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <CandidateCard
                  candidate={candidate}
                  footerText={`Score ${percentage(candidate.scoreEstimate)} • ${decision?.action ?? "PENDING"}${reviewTag ? ` • ${formatReviewTagLabel(reviewTag)}` : ""}`}
                  label={resolveCandidateLabel(candidate, decision)}
                  onSelect={() => onSelectCandidate(candidate.id)}
                  secondaryText={`${summarizeCandidate(candidate, profile)} • ${formatSeconds(candidate.candidateWindow.startSeconds)} to ${formatSeconds(candidate.candidateWindow.endSeconds)}`}
                  selected={isSelected}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
