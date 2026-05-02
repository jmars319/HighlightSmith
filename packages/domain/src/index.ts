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
  ReasonCode,
  ReviewAction,
  ReviewDecision,
  TranscriptChunk,
} from "@vaexcore/pulse-shared-types";

export function resolveCandidateLabel(
  candidate: CandidateWindow,
  decision?: ReviewDecision,
): string {
  return decision?.label ?? candidate.editableLabel;
}

const plainReasonDescriptions: Record<ReasonCode, string> = {
  LOUDNESS_SPIKE: "sudden increase in audio intensity",
  LAUGHTER_BURST: "brief laughter-like audio burst",
  OVERLAP_SPIKE: "multiple voices or sounds rise at once",
  REACTION_PHRASE: "spoken reaction detected",
  COMMENTARY_DENSITY: "sustained spoken commentary",
  SILENCE_BREAK: "quiet stretch followed by renewed activity",
  ACTION_AUDIO_CLUSTER: "cluster of fast action sounds",
  STRUCTURE_SETUP: "setup before a possible event",
  STRUCTURE_CONSEQUENCE: "event appears to create an immediate consequence",
  STRUCTURE_RESOLUTION: "event appears to resolve",
  MENU_HEAVY: "menu or non-gameplay activity",
  CLEANUP_HEAVY: "cleanup or low-payoff activity",
  LOW_INFORMATION: "low activity or unclear outcome",
  CONTEXT_REQUIRED: "surrounding context is still needed",
  TACTICAL_NARRATION: "spoken tactical explanation",
  PITCH_EXCURSION: "noticeable change in vocal pitch",
  ABRUPT_SILENCE_AFTER_INTENSITY: "activity drops quickly after a peak",
};

export type CandidatePlainDescription = {
  summary: string;
  detail: string | null;
  signalPhrases: string[];
};

export function describeReasonCodePlainly(reasonCode: ReasonCode): string {
  return plainReasonDescriptions[reasonCode];
}

export function describeCandidatePlainly(
  candidate: CandidateWindow,
): CandidatePlainDescription {
  const reasonCodes = new Set(candidate.reasonCodes);
  const topSignalPhrases = uniqueReasonCodes(
    candidate.scoreBreakdown
      .filter((item) => item.direction === "POSITIVE")
      .sort((left, right) => right.contribution - left.contribution)
      .map((item) => item.reasonCode),
  )
    .map(describeReasonCodePlainly)
    .slice(0, 3);

  const hasReactionPhrase = reasonCodes.has("REACTION_PHRASE");
  const hasLoudnessSpike = reasonCodes.has("LOUDNESS_SPIKE");
  const hasPitchExcursion = reasonCodes.has("PITCH_EXCURSION");
  const hasActionCluster = reasonCodes.has("ACTION_AUDIO_CLUSTER");
  const hasCommentaryDensity = reasonCodes.has("COMMENTARY_DENSITY");
  const hasTacticalNarration = reasonCodes.has("TACTICAL_NARRATION");
  const hasOverlapSpike = reasonCodes.has("OVERLAP_SPIKE");
  const hasLaughterBurst = reasonCodes.has("LAUGHTER_BURST");
  const hasStructureSetup = reasonCodes.has("STRUCTURE_SETUP");
  const hasStructureConsequence = reasonCodes.has("STRUCTURE_CONSEQUENCE");
  const hasStructureResolution = reasonCodes.has("STRUCTURE_RESOLUTION");
  const hasLowInformation = reasonCodes.has("LOW_INFORMATION");
  const needsContext =
    candidate.contextRequired || reasonCodes.has("CONTEXT_REQUIRED");

  let summary = "Possible moment with limited supporting signals";

  if (hasLowInformation) {
    summary = "Low activity, unclear payoff";
  } else if (
    hasReactionPhrase &&
    (hasLoudnessSpike || hasPitchExcursion || hasActionCluster)
  ) {
    summary = "Short reaction after sudden event";
  } else if (hasStructureSetup && hasStructureResolution) {
    summary = "Quick escalation followed by resolution";
  } else if (hasCommentaryDensity && hasTacticalNarration) {
    summary = "Extended dialogue segment";
  } else if (hasOverlapSpike && hasLaughterBurst) {
    summary = "Brief group reaction or laughter burst";
  } else if (hasOverlapSpike) {
    summary = "Brief burst of overlapping voices";
  } else if (
    hasActionCluster &&
    (hasStructureConsequence || hasStructureResolution)
  ) {
    summary = "High-activity segment with a possible outcome";
  } else if (hasActionCluster) {
    summary = "Short high-activity segment";
  } else if (hasTacticalNarration) {
    summary = "Spoken tactical explanation";
  } else if (hasCommentaryDensity) {
    summary = "Extended dialogue segment";
  } else if (hasStructureSetup) {
    summary = "Setup segment before possible action";
  } else if (hasStructureResolution || hasStructureConsequence) {
    summary = "Possible resolution moment";
  } else if (hasLoudnessSpike || hasPitchExcursion) {
    summary = "Brief increase in activity";
  }

  const lowConfidence =
    candidate.confidenceBand === "LOW" ||
    candidate.confidenceBand === "EXPERIMENTAL" ||
    hasLowInformation;
  const mediumConfidence =
    candidate.confidenceBand === "MEDIUM" || needsContext;

  if (lowConfidence) {
    summary = `Low confidence - ${lowercaseFirst(summary)}`;
  } else if (
    mediumConfidence &&
    !summary.toLowerCase().startsWith("possible ")
  ) {
    summary = `Possible ${lowercaseFirst(summary)}`;
  }

  let detail: string | null = null;
  if (hasLowInformation) {
    detail = "Weak supporting signals.";
  } else if (needsContext) {
    detail = "Needs surrounding context to confirm the outcome.";
  } else if (
    (candidate.confidenceBand === "LOW" ||
      candidate.confidenceBand === "EXPERIMENTAL") &&
    topSignalPhrases.length > 0
  ) {
    detail = `Signals were limited to ${joinReadableList(topSignalPhrases.slice(0, 2))}.`;
  } else if (topSignalPhrases.length > 0) {
    detail = `Signals include ${joinReadableList(topSignalPhrases.slice(0, 2))}.`;
  }

  return {
    summary,
    detail,
    signalPhrases: topSignalPhrases,
  };
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
  const plainDescription = describeCandidatePlainly(candidate);

  return [
    candidate.transcriptSnippet,
    label,
    plainDescription.summary,
    plainDescription.detail ?? "",
    plainDescription.signalPhrases.join(" "),
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
      note: "Add local example clips or indexed profile edits to turn on profile-aware matching.",
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
      note: `Local-file heuristic matching is active from ${usableLocalExampleCount} usable local reference${usableLocalExampleCount === 1 ? "" : "s"}.${ignoredReferenceCopy}`,
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
      note: "This profile only has URL/reference sources right now. Matching is local-file-only in this build.",
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
    note: "Local reference sources are saved, but none are currently usable for matching. Check the file path and local summary readiness.",
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
    return "Estimated media metadata";
  }

  if (flag === "SEEDED_TRANSCRIPT") {
    return "Limited transcript coverage";
  }

  if (flag === "TRANSCRIPT_SPARSE") {
    return "Sparse transcript";
  }

  if (flag === "LOW_CANDIDATE_COUNT") {
    return "Low signal density";
  }

  return "No candidates found";
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

export function summarizeSessionQuality(
  coverage: Pick<AnalysisCoverage, "band" | "flags">,
  candidateCount = 0,
): string {
  if (coverage.flags.includes("NO_CANDIDATES") || candidateCount === 0) {
    return "Analysis returned no strong signals";
  }

  if (
    coverage.flags.includes("SEEDED_TRANSCRIPT") ||
    coverage.flags.includes("TRANSCRIPT_SPARSE")
  ) {
    return "Limited transcript coverage";
  }

  if (
    coverage.band === "THIN" ||
    coverage.flags.includes("LOW_CANDIDATE_COUNT")
  ) {
    return "Low signal density";
  }

  if (coverage.band === "STRONG" && candidateCount >= 3) {
    return "Strong activity detected in multiple regions";
  }

  if (coverage.band === "STRONG") {
    return "Strong activity detected";
  }

  return "Useful signals detected with partial coverage";
}

function uniqueReasonCodes(reasonCodes: ReasonCode[]): ReasonCode[] {
  const seen = new Set<ReasonCode>();

  return reasonCodes.filter((reasonCode) => {
    if (seen.has(reasonCode)) {
      return false;
    }

    seen.add(reasonCode);
    return true;
  });
}

function lowercaseFirst(value: string): string {
  return value.length > 0
    ? value.charAt(0).toLowerCase() + value.slice(1)
    : value;
}

function joinReadableList(values: string[]): string {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0];
  }

  return `${values[0]} and ${values[1]}`;
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

  return pendingCount === 0 ? "ALL" : "ONLY_PENDING";
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
