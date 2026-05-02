import type { ConfidenceBand } from "@vaexcore/pulse-shared-types";

type ConfidenceBadgeProps = {
  band: ConfidenceBand;
};

export function ConfidenceBadge({ band }: ConfidenceBadgeProps) {
  return (
    <span className={`vcp-badge vcp-badge-${band.toLowerCase()}`}>{band}</span>
  );
}
