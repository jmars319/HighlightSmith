import type { ConfidenceBand } from "@highlightsmith/shared-types";

type ConfidenceBadgeProps = {
  band: ConfidenceBand;
};

export function ConfidenceBadge({ band }: ConfidenceBadgeProps) {
  return (
    <span className={`hs-badge hs-badge-${band.toLowerCase()}`}>{band}</span>
  );
}
