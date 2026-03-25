import type { CandidateWindow, ReviewTag } from "@highlightsmith/shared-types";

const reviewTagLabels: Record<ReviewTag, string> = {
  DEAD_AIR_RISK: "Dead air risk",
  CLEANUP_RISK: "Cleanup risk",
  MENU_RISK: "Menu risk",
  LOW_INFORMATION_RISK: "Low-info risk",
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
