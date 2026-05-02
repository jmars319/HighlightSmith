import type { CandidateWindow, ReviewTag } from "@vaexcore/pulse-shared-types";

const reviewTagLabels: Record<ReviewTag, string> = {
  DEAD_AIR_RISK: "Quiet section",
  CLEANUP_RISK: "Needs cleanup",
  MENU_RISK: "Menu-heavy",
  LOW_INFORMATION_RISK: "Unclear moment",
};

export function formatReviewTagLabel(reviewTag: ReviewTag): string {
  return reviewTagLabels[reviewTag];
}

export function primaryReviewTag(candidate: CandidateWindow): ReviewTag | null {
  return candidate.reviewTags[0] ?? null;
}

export function candidateHasReviewRisk(candidate: CandidateWindow): boolean {
  return candidate.reviewTags.length > 0;
}
