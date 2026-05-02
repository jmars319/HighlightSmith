import type { ConfidenceBand } from "@vaexcore/pulse-shared-types";

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

export const companionSnapshot = {
  dashboard: {
    projectCount: 0,
    pendingCount: 0,
    acceptedCount: 0,
    profileCount: 0,
    primaryProjectTitle: "No synced sessions",
    primaryProfileLabel: "No profile data",
    lastUpdatedLabel: "Unavailable",
    statusLabel: "No synced data yet",
    surfaceNote:
      "This companion app does not load demo sessions or fake queue items.",
  },
  projects: [] as Array<{
    sessionId: string;
    sessionTitle: string;
    profileLabel: string;
    candidateCount: number;
    acceptedCount: number;
    sourcePath: string;
    updatedLabel: string;
  }>,
  queue: [] as Array<{
    id: string;
    label: string;
    transcriptSnippet: string;
    confidenceBand: ConfidenceBand;
    reasonSummary: string;
    windowLabel: string;
  }>,
  acceptedClips: [] as Array<{
    id: string;
    label: string;
    transcriptSnippet: string;
    confidenceBand: ConfidenceBand;
    segmentLabel: string;
  }>,
  profiles: [] as Array<{
    id: string;
    label: string;
    mode: string;
    description: string;
    weightCount: number;
  }>,
  guardrails: [
    "No ingest, analysis launch, or clip rendering on mobile.",
    "No heavy local media processing or VOD analysis on-device.",
    "No demo backlog, fake queue, or fake accepted clips in normal use.",
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
