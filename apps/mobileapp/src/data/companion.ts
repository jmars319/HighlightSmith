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
    surfaceNote: "Synced sessions and clips will appear here when available.",
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
    "Mobile is for checking progress and reviewing saved clips.",
    "Use the desktop app to scan videos or create clips.",
    "Empty projects stay empty until real work is available.",
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
      backgroundColor: "rgba(201, 63, 215, 0.16)",
      textColor: "#fac6ff",
    };
  }

  if (band === "MEDIUM") {
    return {
      label: "MEDIUM",
      backgroundColor: "rgba(66, 173, 230, 0.18)",
      textColor: "#b8eeff",
    };
  }

  if (band === "LOW") {
    return {
      label: "LOW",
      backgroundColor: "rgba(102, 217, 184, 0.14)",
      textColor: "#c9f8e9",
    };
  }

  return {
    label: "EXPERIMENTAL",
    backgroundColor: "rgba(126, 101, 255, 0.16)",
    textColor: "#d8d0ff",
  };
}
