import type { CandidateWindow } from "@vaexcore/pulse-shared-types";
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
      className={
        selected ? "vcp-candidate-card selected" : "vcp-candidate-card"
      }
      onClick={onSelect}
      type={onSelect ? "button" : undefined}
    >
      <div className="vcp-candidate-row">
        <ConfidenceBadge band={candidate.confidenceBand} />
        <span className="vcp-meta">
          {candidate.candidateWindow.startSeconds.toFixed(0)}s to{" "}
          {candidate.candidateWindow.endSeconds.toFixed(0)}s
        </span>
      </div>
      <strong>{label}</strong>
      <p className="vcp-muted">{candidate.transcriptSnippet}</p>
      {secondaryText ? <p className="vcp-secondary">{secondaryText}</p> : null}
      {footerText ? <span className="vcp-meta">{footerText}</span> : null}
    </Wrapper>
  );
}
