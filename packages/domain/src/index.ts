import type {
  AnalysisCoverage,
  AnalysisCoverageBand,
  CandidateProfileMatch,
  CandidateDecisionMap,
  CandidateWindow,
  ClipProfile,
  ConfidenceBand,
  ProfileMatchingSummary,
  ProfilePresentationMode,
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

export function buildProfileMatchingSummary(
  profile: Pick<ClipProfile, "id" | "exampleClips">,
): ProfileMatchingSummary {
  const totalExampleCount = profile.exampleClips.length;
  const usableLocalExampleCount = profile.exampleClips.filter(
    (example) =>
      (example.sourceType === "LOCAL_FILE_PATH" ||
        example.sourceType === "LOCAL_FILE_UPLOAD") &&
      example.status === "LOCAL_FILE_AVAILABLE" &&
      Boolean(example.featureSummary),
  ).length;
  const referenceOnlyExampleCount = profile.exampleClips.filter(
    (example) =>
      example.sourceType === "TWITCH_CLIP_URL" ||
      example.sourceType === "YOUTUBE_SHORT_URL" ||
      example.status === "REFERENCE_ONLY",
  ).length;
  const unavailableLocalExampleCount = Math.max(
    totalExampleCount - usableLocalExampleCount - referenceOnlyExampleCount,
    0,
  );

  if (totalExampleCount === 0) {
    return {
      profileId: profile.id,
      totalExampleCount,
      usableLocalExampleCount,
      referenceOnlyExampleCount,
      unavailableLocalExampleCount,
      ready: false,
      method: "NONE",
      note: "Add local example clips to turn on profile-aware matching.",
    };
  }

  if (usableLocalExampleCount > 0) {
    const ignoredReferenceCopy =
      referenceOnlyExampleCount > 0
        ? ` ${referenceOnlyExampleCount} stored reference${referenceOnlyExampleCount === 1 ? "" : "s"} remain out of scope for matching in this build.`
        : "";
    return {
      profileId: profile.id,
      totalExampleCount,
      usableLocalExampleCount,
      referenceOnlyExampleCount,
      unavailableLocalExampleCount,
      ready: true,
      method: "LOCAL_FILE_HEURISTIC",
      note: `Local-file heuristic matching is active from ${usableLocalExampleCount} usable example${usableLocalExampleCount === 1 ? "" : "s"}.${ignoredReferenceCopy}`,
    };
  }

  if (referenceOnlyExampleCount > 0 && unavailableLocalExampleCount === 0) {
    return {
      profileId: profile.id,
      totalExampleCount,
      usableLocalExampleCount,
      referenceOnlyExampleCount,
      unavailableLocalExampleCount,
      ready: false,
      method: "NONE",
      note: "This profile only has URL/reference examples right now. Matching is local-file-only in this build.",
    };
  }

  return {
    profileId: profile.id,
    totalExampleCount,
    usableLocalExampleCount,
    referenceOnlyExampleCount,
    unavailableLocalExampleCount,
    ready: false,
    method: "NONE",
    note: "Local example references are saved, but none are currently usable for matching. Check the file path and local summary readiness.",
  };
}

export function resolveCandidateProfileMatch(
  candidate: Pick<CandidateWindow, "profileMatches">,
  profile: Pick<ClipProfile, "id" | "exampleClips">,
): CandidateProfileMatch {
  const storedMatch = candidate.profileMatches.find(
    (match) => match.profileId === profile.id,
  );

  if (storedMatch) {
    return storedMatch;
  }

  const summary = buildProfileMatchingSummary(profile);

  return {
    profileId: profile.id,
    method: summary.method,
    status: summary.totalExampleCount > 0 ? "PLACEHOLDER" : "UNASSESSED",
    strength: "UNASSESSED",
    note: summary.note,
    matchedExampleClipIds: [],
    comparedExampleCount: summary.usableLocalExampleCount,
    supportingFactors: [],
    limitingFactors: [],
  };
}

export function hasStrongCandidateProfileMatch(
  candidate: Pick<CandidateWindow, "profileMatches">,
  profile: Pick<ClipProfile, "id" | "exampleClips">,
): boolean {
  const match = resolveCandidateProfileMatch(candidate, profile);
  return match.strength === "STRONG";
}

export function filterCandidatesByPresentationMode(
  candidates: CandidateWindow[],
  profile: Pick<ClipProfile, "id" | "exampleClips">,
  presentationMode: ProfilePresentationMode,
): CandidateWindow[] {
  if (presentationMode === "PROFILE_VIEW") {
    return [...candidates].sort((left, right) => {
      const leftMatch = resolveCandidateProfileMatch(left, profile);
      const rightMatch = resolveCandidateProfileMatch(right, profile);
      const strengthRank = profileMatchStrengthRank(leftMatch.strength);
      const rightStrengthRank = profileMatchStrengthRank(rightMatch.strength);
      if (strengthRank !== rightStrengthRank) {
        return strengthRank - rightStrengthRank;
      }

      const leftScore = leftMatch.similarityScore ?? -1;
      const rightScore = rightMatch.similarityScore ?? -1;
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return right.scoreEstimate - left.scoreEstimate;
    });
  }

  if (presentationMode !== "STRONG_MATCHES") {
    return [...candidates];
  }

  const strongMatches = candidates.filter((candidate) =>
    hasStrongCandidateProfileMatch(candidate, profile),
  );

  return strongMatches.length > 0 ? strongMatches : candidates;
}

function profileMatchStrengthRank(
  strength: CandidateProfileMatch["strength"],
): number {
  if (strength === "STRONG") {
    return 0;
  }

  if (strength === "POSSIBLE") {
    return 1;
  }

  if (strength === "WEAK") {
    return 2;
  }

  return 3;
}

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
    .filter(
      (chunk) => chunk.endSeconds <= candidate.candidateWindow.startSeconds,
    )
    .slice(-sideCount);
  const inside = sortedTranscript.filter(
    (chunk) =>
      chunk.startSeconds < candidate.candidateWindow.endSeconds &&
      chunk.endSeconds > candidate.candidateWindow.startSeconds,
  );
  const after = sortedTranscript
    .filter(
      (chunk) => chunk.startSeconds >= candidate.candidateWindow.endSeconds,
    )
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

export function formatAnalysisCoverageBand(band: AnalysisCoverageBand): string {
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

  return candidates.filter((candidate) =>
    isCandidatePending(session, candidate.id),
  );
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
