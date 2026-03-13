import type {
  CandidateWindow,
  ConfidenceBand,
  ReviewDecision,
  ContentProfile,
} from "@highlightsmith/shared-types";
import { resolveCandidateLabel } from "@highlightsmith/domain";
import { summarizeCandidate } from "@highlightsmith/scoring";
import { CandidateCard } from "@highlightsmith/ui";
import { formatSeconds, percentage } from "../lib/format";

type CandidateQueueProps = {
  candidates: CandidateWindow[];
  selectedCandidateId: string | null;
  decisionsByCandidateId: Record<string, ReviewDecision>;
  profile: ContentProfile;
  searchValue: string;
  deferredSearchValue: string;
  onSearchChange: (value: string) => void;
  bandFilter: ConfidenceBand | "ALL";
  onBandFilterChange: (value: ConfidenceBand | "ALL") => void;
  onSelectCandidate: (candidateId: string) => void;
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
  searchValue,
  deferredSearchValue,
  onSearchChange,
  bandFilter,
  onBandFilterChange,
  onSelectCandidate,
}: CandidateQueueProps) {
  return (
    <section className="queue-panel glass-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Review queue</p>
          <h2>Candidate windows</h2>
        </div>
        <span className="queue-count">{candidates.length} visible</span>
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

      <div className="candidate-list">
        {candidates.map((candidate, index) => {
          const decision = decisionsByCandidateId[candidate.id];
          const isSelected = candidate.id === selectedCandidateId;

          return (
            <div
              key={candidate.id}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <CandidateCard
                candidate={candidate}
                footerText={`Score ${percentage(candidate.scoreEstimate)} • ${decision?.action ?? "PENDING"}`}
                label={resolveCandidateLabel(candidate, decision)}
                onSelect={() => onSelectCandidate(candidate.id)}
                secondaryText={`${summarizeCandidate(candidate, profile)} • ${formatSeconds(candidate.candidateWindow.startSeconds)} to ${formatSeconds(candidate.candidateWindow.endSeconds)}`}
                selected={isSelected}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
