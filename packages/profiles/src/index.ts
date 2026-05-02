import type { ClipProfile } from "@vaexcore/pulse-shared-types";

const systemProfileTimestamp = "2026-04-11T00:00:00.000Z";

export const contentProfiles: ClipProfile[] = [
  {
    id: "generic",
    name: "Generic",
    label: "Generic",
    description:
      "High-recall surfacing for creator review. Always available regardless of personalization state.",
    createdAt: systemProfileTimestamp,
    updatedAt: systemProfileTimestamp,
    state: "ACTIVE",
    source: "SYSTEM",
    mode: "BROAD",
    signalWeights: {
      REACTION_PHRASE: 1,
      LOUDNESS_SPIKE: 0.95,
      COMMENTARY_DENSITY: 0.75,
      STRUCTURE_SETUP: 0.65,
      STRUCTURE_CONSEQUENCE: 0.7,
      STRUCTURE_RESOLUTION: 0.7,
      MENU_HEAVY: -0.75,
      CLEANUP_HEAVY: -0.6,
      LOW_INFORMATION: -0.45,
      CONTEXT_REQUIRED: -0.25,
    },
    exampleClips: [],
  },
  {
    id: "stealth",
    name: "Stealth",
    label: "Stealth",
    description:
      "Rewards tension, anticipation, and payoff while suppressing noisy false positives.",
    createdAt: systemProfileTimestamp,
    updatedAt: systemProfileTimestamp,
    state: "ACTIVE",
    source: "SYSTEM",
    mode: "CONTEXTUAL",
    signalWeights: {
      STRUCTURE_SETUP: 0.95,
      TACTICAL_NARRATION: 0.9,
      SILENCE_BREAK: 0.8,
      ABRUPT_SILENCE_AFTER_INTENSITY: 0.75,
      COMMENTARY_DENSITY: 0.55,
      LOUDNESS_SPIKE: 0.35,
      MENU_HEAVY: -0.85,
      CLEANUP_HEAVY: -0.7,
    },
    exampleClips: [],
  },
  {
    id: "raid_coop",
    name: "Raid / Co-op",
    label: "Raid / Co-op",
    description:
      "Prioritizes team chatter, overlap spikes, wipes, recoveries, and shared reactions.",
    createdAt: systemProfileTimestamp,
    updatedAt: systemProfileTimestamp,
    state: "ACTIVE",
    source: "SYSTEM",
    mode: "CONTEXTUAL",
    signalWeights: {
      OVERLAP_SPIKE: 1,
      LAUGHTER_BURST: 0.8,
      COMMENTARY_DENSITY: 0.75,
      STRUCTURE_CONSEQUENCE: 0.85,
      STRUCTURE_RESOLUTION: 0.8,
      ACTION_AUDIO_CLUSTER: 0.65,
      CLEANUP_HEAVY: -0.55,
      LOW_INFORMATION: -0.5,
    },
    exampleClips: [],
  },
  {
    id: "exploration",
    name: "Exploration",
    label: "Exploration",
    description:
      "Biases toward discovery, realization, and clue-resolution pacing over pure intensity.",
    createdAt: systemProfileTimestamp,
    updatedAt: systemProfileTimestamp,
    state: "ACTIVE",
    source: "SYSTEM",
    mode: "CONTEXTUAL",
    signalWeights: {
      STRUCTURE_SETUP: 0.9,
      STRUCTURE_RESOLUTION: 0.95,
      REACTION_PHRASE: 0.7,
      PITCH_EXCURSION: 0.55,
      COMMENTARY_DENSITY: 0.45,
      LOUDNESS_SPIKE: 0.2,
      LOW_INFORMATION: -0.3,
      CONTEXT_REQUIRED: -0.15,
    },
    exampleClips: [],
  },
];

export const defaultProfileId = "generic";

export function getProfileById(profileId: string): ClipProfile {
  return (
    contentProfiles.find((profile) => profile.id === profileId) ??
    contentProfiles[0]
  );
}
