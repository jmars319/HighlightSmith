import type {
  CandidateWindow,
  ConfidenceBand,
  ContentProfile,
  ReasonCode,
  ScoreContribution,
} from "@highlightsmith/shared";

const reasonLabels: Record<ReasonCode, string> = {
  LOUDNESS_SPIKE: "Loudness spike",
  LAUGHTER_BURST: "Laughter burst",
  OVERLAP_SPIKE: "Overlap spike",
  REACTION_PHRASE: "Reaction phrase",
  COMMENTARY_DENSITY: "Commentary density",
  SILENCE_BREAK: "Silence break",
  ACTION_AUDIO_CLUSTER: "Action audio cluster",
  STRUCTURE_SETUP: "Structure setup",
  STRUCTURE_CONSEQUENCE: "Structure consequence",
  STRUCTURE_RESOLUTION: "Structure resolution",
  MENU_HEAVY: "Menu heavy",
  CLEANUP_HEAVY: "Cleanup heavy",
  LOW_INFORMATION: "Low information",
  CONTEXT_REQUIRED: "Context required",
  TACTICAL_NARRATION: "Tactical narration",
  PITCH_EXCURSION: "Pitch excursion",
  ABRUPT_SILENCE_AFTER_INTENSITY: "Abrupt silence after intensity",
};

export function reasonCodeLabel(reasonCode: ReasonCode): string {
  return reasonLabels[reasonCode];
}

export function confidenceBandFromScore(score: number): ConfidenceBand {
  if (score >= 0.8) {
    return "HIGH";
  }

  if (score >= 0.58) {
    return "MEDIUM";
  }

  if (score >= 0.35) {
    return "LOW";
  }

  return "EXPERIMENTAL";
}

export function scoreFromBreakdown(
  breakdown: ScoreContribution[],
  profile?: ContentProfile,
): number {
  const weightedTotal = breakdown.reduce((sum, contribution) => {
    const profileWeight = profile?.signalWeights[contribution.reasonCode] ?? 1;
    return sum + contribution.contribution * profileWeight;
  }, 0);

  return Math.max(0, Math.min(1, weightedTotal));
}

export function summarizeCandidate(
  candidate: CandidateWindow,
  profile?: ContentProfile,
): string {
  const topReasons = [...candidate.scoreBreakdown]
    .sort((left, right) => {
      const leftWeight = profile?.signalWeights[left.reasonCode] ?? 1;
      const rightWeight = profile?.signalWeights[right.reasonCode] ?? 1;
      return (
        right.contribution * rightWeight - left.contribution * leftWeight
      );
    })
    .slice(0, 3)
    .map((item) => item.label);

  return topReasons.join(" • ");
}
