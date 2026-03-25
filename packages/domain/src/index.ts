import type {
  AnalysisCoverage,
  AnalysisCoverageBand,
  CandidateDecisionMap,
  CandidateWindow,
  ConfidenceBand,
  ProjectSession,
  ProjectSessionSummary,
  ReviewAction,
  ReviewDecision,
  TranscriptChunk,
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
  return [
    candidate.transcriptSnippet,
    label,
    candidate.reasonCodes.join(" "),
    candidate.reviewTags.join(" "),
  ]
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

export type CandidateTranscriptContext = {
  before: TranscriptChunk[];
  inside: TranscriptChunk[];
  after: TranscriptChunk[];
};

export type ReviewQueueMode = "ONLY_PENDING" | "ALL";

export function buildCandidateTranscriptContext(
  transcript: TranscriptChunk[],
  candidate: CandidateWindow,
  options: {
    sideCount?: number;
  } = {},
): CandidateTranscriptContext {
  const sideCount = options.sideCount ?? 2;
  const sortedTranscript = [...transcript].sort(
    (left, right) => left.startSeconds - right.startSeconds,
  );
  const before = sortedTranscript
    .filter((chunk) => chunk.endSeconds <= candidate.candidateWindow.startSeconds)
    .slice(-sideCount);
  const inside = sortedTranscript.filter(
    (chunk) =>
      chunk.startSeconds < candidate.candidateWindow.endSeconds &&
      chunk.endSeconds > candidate.candidateWindow.startSeconds,
  );
  const after = sortedTranscript
    .filter((chunk) => chunk.startSeconds >= candidate.candidateWindow.endSeconds)
    .slice(0, sideCount);

  return {
    before,
    inside,
    after,
  };
}

export function buildProjectSummary(
  session: ProjectSession,
): ProjectSessionSummary {
  const acceptedCount = session.reviewDecisions.filter(
    (decision) => decision.action === "ACCEPT",
  ).length;
  const rejectedCount = session.reviewDecisions.filter(
    (decision) => decision.action === "REJECT",
  ).length;

  return {
    sessionId: session.id,
    sessionTitle: session.title,
    sourcePath: session.mediaSource.path,
    sourceName: session.mediaSource.fileName,
    status: session.status,
    analysisCoverage: session.analysisCoverage,
    profileId: session.profileId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    candidateCount: session.candidates.length,
    acceptedCount,
    rejectedCount,
    pendingCount: Math.max(
      session.candidates.length - acceptedCount - rejectedCount,
      0,
    ),
  };
}

export function formatAnalysisCoverageBand(
  band: AnalysisCoverageBand,
): string {
  if (band === "STRONG") {
    return "Strong";
  }

  if (band === "THIN") {
    return "Thin";
  }

  return "Partial";
}

export function formatAnalysisCoverageFlag(
  flag: AnalysisCoverage["flags"][number],
): string {
  if (flag === "METADATA_FALLBACK_USED") {
    return "Metadata fallback";
  }

  if (flag === "SEEDED_TRANSCRIPT") {
    return "Seeded transcript";
  }

  if (flag === "TRANSCRIPT_SPARSE") {
    return "Sparse transcript";
  }

  if (flag === "LOW_CANDIDATE_COUNT") {
    return "Low candidate count";
  }

  return "No candidates";
}

export function analysisCoverageTone(
  coverage: Pick<AnalysisCoverage, "band">,
): "strong" | "partial" | "thin" {
  if (coverage.band === "STRONG") {
    return "strong";
  }

  if (coverage.band === "THIN") {
    return "thin";
  }

  return "partial";
}

export function isCandidatePending(
  session: Pick<ProjectSession, "reviewDecisions">,
  candidateId: string,
): boolean {
  const latestDecision = session.reviewDecisions.find(
    (decision) => decision.candidateId === candidateId,
  );
  return (
    latestDecision?.action !== "ACCEPT" && latestDecision?.action !== "REJECT"
  );
}

export function defaultReviewQueueMode(
  session: Pick<ProjectSession, "candidates" | "reviewDecisions">,
): ReviewQueueMode {
  const pendingCount = session.candidates.filter((candidate) =>
    isCandidatePending(session, candidate.id),
  ).length;

  if (pendingCount === 0) {
    return "ALL";
  }

  return pendingCount < session.candidates.length ? "ONLY_PENDING" : "ALL";
}

export function filterCandidatesByReviewMode(
  candidates: CandidateWindow[],
  session: Pick<ProjectSession, "reviewDecisions">,
  reviewQueueMode: ReviewQueueMode,
): CandidateWindow[] {
  if (reviewQueueMode === "ALL") {
    return candidates;
  }

  return candidates.filter((candidate) => isCandidatePending(session, candidate.id));
}

export function reviewedCandidateCount(summary: ProjectSessionSummary): number {
  return summary.acceptedCount + summary.rejectedCount;
}

export function deriveSessionReviewState(
  summary: ProjectSessionSummary,
): "PENDING" | "IN_PROGRESS" | "REVIEWED" {
  const reviewedCount = reviewedCandidateCount(summary);
  if (reviewedCount === 0) {
    return "PENDING";
  }

  if (summary.pendingCount === 0) {
    return "REVIEWED";
  }

  return "IN_PROGRESS";
}

export function findNextPendingSessionSummary(
  summaries: ProjectSessionSummary[],
  options: {
    excludeSessionIds?: string[];
    preferInProgress?: boolean;
  } = {},
): ProjectSessionSummary | null {
  const excludedSessionIds = new Set(options.excludeSessionIds ?? []);
  const pendingSummaries = summaries.filter(
    (summary) =>
      summary.pendingCount > 0 && !excludedSessionIds.has(summary.sessionId),
  );

  if (pendingSummaries.length === 0) {
    return null;
  }

  if (options.preferInProgress !== false) {
    const inProgressSummary = pendingSummaries.find(
      (summary) => deriveSessionReviewState(summary) === "IN_PROGRESS",
    );
    if (inProgressSummary) {
      return inProgressSummary;
    }
  }

  return pendingSummaries[0];
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
