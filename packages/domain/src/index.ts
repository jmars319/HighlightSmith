import type {
  CandidateDecisionMap,
  CandidateWindow,
  ConfidenceBand,
  ProjectSession,
  ReviewAction,
  ReviewDecision,
} from "@highlightsmith/shared-types";

export function resolveCandidateLabel(
  candidate: CandidateWindow,
  decision?: ReviewDecision,
): string {
  return decision?.label ?? candidate.editableLabel;
}

export function decisionForCandidate(
  candidateId: string,
  decisionsByCandidateId: CandidateDecisionMap,
): ReviewDecision | undefined {
  return decisionsByCandidateId[candidateId];
}

export function buildCandidateSearchText(
  candidate: CandidateWindow,
  label: string,
): string {
  return [candidate.transcriptSnippet, label, candidate.reasonCodes.join(" ")]
    .join(" ")
    .toLowerCase();
}

export function filterCandidates(
  candidates: CandidateWindow[],
  query: string,
  band: ConfidenceBand | "ALL",
  decisionsByCandidateId: CandidateDecisionMap,
): CandidateWindow[] {
  const normalizedQuery = query.trim().toLowerCase();

  return candidates.filter((candidate) => {
    if (band !== "ALL" && candidate.confidenceBand !== band) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return buildCandidateSearchText(
      candidate,
      resolveCandidateLabel(candidate, decisionsByCandidateId[candidate.id]),
    ).includes(normalizedQuery);
  });
}

export function acceptedCandidates(
  candidates: CandidateWindow[],
  decisionsByCandidateId: CandidateDecisionMap,
): CandidateWindow[] {
  return candidates.filter(
    (candidate) => decisionsByCandidateId[candidate.id]?.action === "ACCEPT",
  );
}

export function buildProjectSummary(session: ProjectSession) {
  return {
    id: session.id,
    title: session.title,
    profileId: session.profileId,
    candidateCount: session.candidates.length,
    acceptedCount: session.reviewDecisions.filter(
      (decision) => decision.action === "ACCEPT",
    ).length,
    updatedAt: session.updatedAt,
    mediaPath: session.mediaSource.path,
  };
}

export function makeReviewDecision(
  projectSessionId: string,
  candidateId: string,
  action: ReviewAction,
  overrides: Partial<ReviewDecision> = {},
): ReviewDecision {
  return {
    id: `${projectSessionId}:${candidateId}:${action}:${Date.now()}`,
    projectSessionId,
    candidateId,
    action,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
