import type { CandidateWindow } from "@highlightsmith/shared-types";
import { ConfidenceBadge } from "./ConfidenceBadge";

type CandidateCardProps = {
  candidate: CandidateWindow;
  label: string;
  secondaryText?: string;
  footerText?: string;
  selected?: boolean;
  onSelect?: () => void;
};

export function CandidateCard({
  candidate,
  label,
  secondaryText,
  footerText,
  selected = false,
  onSelect,
}: CandidateCardProps) {
  const Wrapper = onSelect ? "button" : "article";

  return (
    <Wrapper
      className={selected ? "hs-candidate-card selected" : "hs-candidate-card"}
      onClick={onSelect}
      type={onSelect ? "button" : undefined}
    >
      <div className="hs-candidate-row">
        <ConfidenceBadge band={candidate.confidenceBand} />
        <span className="hs-meta">
          {candidate.candidateWindow.startSeconds.toFixed(0)}s to{" "}
          {candidate.candidateWindow.endSeconds.toFixed(0)}s
        </span>
      </div>
      <strong>{label}</strong>
      <p className="hs-muted">{candidate.transcriptSnippet}</p>
      {secondaryText ? <p className="hs-secondary">{secondaryText}</p> : null}
      {footerText ? <span className="hs-meta">{footerText}</span> : null}
    </Wrapper>
  );
}
