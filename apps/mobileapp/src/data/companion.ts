import {
  acceptedCandidates,
  buildProjectSummary,
} from "@highlightsmith/domain";
import { contentProfiles, getProfileById } from "@highlightsmith/profiles";
import {
  createMockProjectSessions,
  createMockReviewHistory,
  type ConfidenceBand,
  type ReviewDecision,
} from "@highlightsmith/shared-types";

export type MobileTab =
  | "dashboard"
  | "projects"
  | "queue"
  | "clips"
  | "profiles";

export const mobileTabs: Array<{ id: MobileTab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "projects", label: "Projects" },
  { id: "queue", label: "Queue" },
  { id: "clips", label: "Clips" },
  { id: "profiles", label: "Profiles" },
];

const projectSessions = createMockProjectSessions();
const reviewHistory = createMockReviewHistory();
const primarySession = projectSessions[0];
const primaryProfile = getProfileById(primarySession.profileId);
const reviewDecisionMap = buildDecisionMap(reviewHistory);

export const companionSnapshot = {
  dashboard: {
    projectCount: projectSessions.length,
    pendingCount: primarySession.candidates.filter(
      (candidate) => !reviewDecisionMap[candidate.id],
    ).length,
    acceptedCount: acceptedCandidates(
      primarySession.candidates,
      reviewDecisionMap,
    ).length,
    profileCount: contentProfiles.length,
    primaryProjectTitle: primarySession.title,
    primaryProfileLabel: primaryProfile.label,
    lastUpdatedLabel: formatDate(primarySession.updatedAt),
    statusLabel: "Local mock companion snapshot",
    surfaceNote: "Desktop remains the primary operator surface.",
  },
  projects: projectSessions.map((session) => {
    const summary = buildProjectSummary(session);
    const profile = getProfileById(summary.profileId);

    return {
      ...summary,
      profileLabel: profile.label,
      updatedLabel: formatDate(summary.updatedAt),
    };
  }),
  queue: primarySession.candidates
    .filter((candidate) => !reviewDecisionMap[candidate.id])
    .map((candidate) => ({
      id: candidate.id,
      label: candidate.editableLabel,
      transcriptSnippet: candidate.transcriptSnippet,
      confidenceBand: candidate.confidenceBand,
      reasonSummary: candidate.reasonCodes.join(" • "),
      windowLabel: formatRange(
        candidate.candidateWindow.startSeconds,
        candidate.candidateWindow.endSeconds,
      ),
    })),
  acceptedClips: acceptedCandidates(
    primarySession.candidates,
    reviewDecisionMap,
  ).map((candidate) => ({
    id: candidate.id,
    label: reviewDecisionMap[candidate.id]?.label ?? candidate.editableLabel,
    transcriptSnippet: candidate.transcriptSnippet,
    confidenceBand: candidate.confidenceBand,
    segmentLabel: formatRange(
      candidate.suggestedSegment.startSeconds,
      candidate.suggestedSegment.endSeconds,
    ),
  })),
  profiles: contentProfiles.map((profile) => ({
    id: profile.id,
    label: profile.label,
    mode: profile.mode,
    description: profile.description,
    weightCount: Object.keys(profile.signalWeights).length,
  })),
  guardrails: [
    "No ingest, analysis launch, or clip rendering on mobile.",
    "No heavy local media processing or VOD analysis on-device.",
    "No fake sync or cloud-only architecture added just to justify mobile.",
  ],
};

export function bandTone(band: ConfidenceBand): {
  label: string;
  backgroundColor: string;
  textColor: string;
} {
  if (band === "HIGH") {
    return {
      label: "HIGH",
      backgroundColor: "rgba(106, 186, 193, 0.18)",
      textColor: "#9de0e3",
    };
  }

  if (band === "MEDIUM") {
    return {
      label: "MEDIUM",
      backgroundColor: "rgba(244, 176, 97, 0.18)",
      textColor: "#ffd59a",
    };
  }

  if (band === "LOW") {
    return {
      label: "LOW",
      backgroundColor: "rgba(188, 193, 205, 0.18)",
      textColor: "#dae0ea",
    };
  }

  return {
    label: "EXPERIMENTAL",
    backgroundColor: "rgba(225, 125, 120, 0.18)",
    textColor: "#ffb7b0",
  };
}

function buildDecisionMap(
  decisions: ReviewDecision[],
): Record<string, ReviewDecision> {
  return decisions.reduce<Record<string, ReviewDecision>>(
    (current, decision) => {
      current[decision.candidateId] = decision;
      return current;
    },
    {},
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRange(startSeconds: number, endSeconds: number): string {
  return `${formatClock(startSeconds)} to ${formatClock(endSeconds)}`;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
