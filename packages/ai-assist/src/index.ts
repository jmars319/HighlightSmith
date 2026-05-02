import type {
  CandidateWindow,
  ContentProfile,
} from "@vaexcore/pulse-shared-types";

export function explainCandidatePlaceholder(
  candidate: CandidateWindow,
  profile?: ContentProfile,
): string {
  const profileLabel = profile?.label ?? "Generic";
  return `Optional AI assist could turn ${candidate.confidenceBand.toLowerCase()} confidence signals into a creator-readable explanation for the ${profileLabel} profile.`;
}

export function suggestTitlePlaceholder(candidate: CandidateWindow): string {
  return `${candidate.editableLabel} (AI assist placeholder)`;
}
