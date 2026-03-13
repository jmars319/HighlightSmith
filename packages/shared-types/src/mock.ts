import {
  defaultSettings,
  projectSessionSchema,
  type ProjectSession,
  type ReviewDecision,
} from "./domain";

export function createMockProjectSession(): ProjectSession {
  return projectSessionSchema.parse({
    id: "session_demo_local",
    title: "Raid Night Demo Review",
    status: "REVIEWING",
    mediaSource: {
      id: "media_demo_001",
      path: "/Users/jason_marshall/VODs/raid-night-2026-03-07.mkv",
      kind: "VIDEO",
      fileName: "raid-night-2026-03-07.mkv",
      durationSeconds: 8342,
      format: "mkv",
      fileSizeBytes: 18723498765,
      frameRate: 60,
      ingestNotes: [
        "Mock session is loaded in the UI until the analyzer is wired in.",
        "FFmpeg ingest and transcript provider hooks are scaffolded but still TODO.",
      ],
    },
    profileId: "generic",
    settings: defaultSettings,
    transcript: [
      {
        id: "chunk_001",
        startSeconds: 318,
        endSeconds: 322,
        text: "wait wait no way that worked",
        confidence: 0.97,
      },
      {
        id: "chunk_002",
        startSeconds: 1458,
        endSeconds: 1462,
        text: "okay here we go push now",
        confidence: 0.93,
      },
      {
        id: "chunk_003",
        startSeconds: 4240,
        endSeconds: 4244,
        text: "we survived that by inches",
        confidence: 0.96,
      },
      {
        id: "chunk_004",
        startSeconds: 6112,
        endSeconds: 6117,
        text: "this might be bad unless that puzzle path loops back",
        confidence: 0.88,
      },
    ],
    speechRegions: [
      {
        id: "speech_001",
        startSeconds: 314,
        endSeconds: 329,
        speechDensity: 0.86,
        overlapActivity: 0.22,
      },
      {
        id: "speech_002",
        startSeconds: 1453,
        endSeconds: 1469,
        speechDensity: 0.78,
        overlapActivity: 0.58,
      },
      {
        id: "speech_003",
        startSeconds: 4238,
        endSeconds: 4251,
        speechDensity: 0.9,
        overlapActivity: 0.64,
      },
      {
        id: "speech_004",
        startSeconds: 6108,
        endSeconds: 6123,
        speechDensity: 0.55,
        overlapActivity: 0.12,
      },
    ],
    featureWindows: [
      {
        id: "feature_001",
        startSeconds: 316,
        endSeconds: 318,
        rmsLoudness: 0.8,
        onsetDensity: 0.76,
        spectralContrast: 0.72,
        zeroCrossingRate: 0.42,
        speechDensity: 0.84,
        overlapActivity: 0.28,
        laughterLikeBurst: 0.18,
        pitchExcursion: 0.7,
        abruptSilenceAfterIntensity: 0.55,
      },
      {
        id: "feature_002",
        startSeconds: 1458,
        endSeconds: 1460,
        rmsLoudness: 0.71,
        onsetDensity: 0.68,
        spectralContrast: 0.63,
        zeroCrossingRate: 0.36,
        speechDensity: 0.78,
        overlapActivity: 0.6,
        laughterLikeBurst: 0.1,
        pitchExcursion: 0.51,
        abruptSilenceAfterIntensity: 0.22,
      },
      {
        id: "feature_003",
        startSeconds: 4240,
        endSeconds: 4242,
        rmsLoudness: 0.83,
        onsetDensity: 0.71,
        spectralContrast: 0.77,
        zeroCrossingRate: 0.41,
        speechDensity: 0.9,
        overlapActivity: 0.67,
        laughterLikeBurst: 0.74,
        pitchExcursion: 0.62,
        abruptSilenceAfterIntensity: 0.49,
      },
      {
        id: "feature_004",
        startSeconds: 6112,
        endSeconds: 6114,
        rmsLoudness: 0.42,
        onsetDensity: 0.33,
        spectralContrast: 0.46,
        zeroCrossingRate: 0.22,
        speechDensity: 0.54,
        overlapActivity: 0.12,
        laughterLikeBurst: 0.02,
        pitchExcursion: 0.39,
        abruptSilenceAfterIntensity: 0.05,
      },
    ],
    candidates: [
      {
        id: "candidate_001",
        candidateWindow: {
          startSeconds: 310,
          endSeconds: 350,
        },
        suggestedSegment: {
          startSeconds: 316,
          endSeconds: 344,
          setupPaddingSeconds: 6,
          resolutionPaddingSeconds: 8,
          trimDeadAirApplied: true,
        },
        confidenceBand: "HIGH",
        scoreEstimate: 0.91,
        reasonCodes: [
          "REACTION_PHRASE",
          "LOUDNESS_SPIKE",
          "STRUCTURE_RESOLUTION",
        ],
        transcriptSnippet: "wait wait no way that worked",
        scoreBreakdown: [
          {
            reasonCode: "REACTION_PHRASE",
            label: "Reaction phrase cluster",
            contribution: 0.38,
            direction: "POSITIVE",
          },
          {
            reasonCode: "LOUDNESS_SPIKE",
            label: "Loudness spike",
            contribution: 0.27,
            direction: "POSITIVE",
          },
          {
            reasonCode: "STRUCTURE_RESOLUTION",
            label: "Clear consequence / payoff",
            contribution: 0.26,
            direction: "POSITIVE",
          },
        ],
        contextRequired: false,
        editableLabel: "Clutch escape payoff",
      },
      {
        id: "candidate_002",
        candidateWindow: {
          startSeconds: 1448,
          endSeconds: 1486,
        },
        suggestedSegment: {
          startSeconds: 1454,
          endSeconds: 1479,
          setupPaddingSeconds: 6,
          resolutionPaddingSeconds: 8,
          trimDeadAirApplied: false,
        },
        confidenceBand: "MEDIUM",
        scoreEstimate: 0.7,
        reasonCodes: [
          "TACTICAL_NARRATION",
          "COMMENTARY_DENSITY",
          "STRUCTURE_SETUP",
        ],
        transcriptSnippet: "okay here we go push now",
        scoreBreakdown: [
          {
            reasonCode: "TACTICAL_NARRATION",
            label: "Tactical framing",
            contribution: 0.24,
            direction: "POSITIVE",
          },
          {
            reasonCode: "COMMENTARY_DENSITY",
            label: "Sustained commentary density",
            contribution: 0.23,
            direction: "POSITIVE",
          },
          {
            reasonCode: "STRUCTURE_SETUP",
            label: "Setup language before action",
            contribution: 0.18,
            direction: "POSITIVE",
          },
        ],
        contextRequired: false,
        editableLabel: "Push call before engagement",
      },
      {
        id: "candidate_003",
        candidateWindow: {
          startSeconds: 4234,
          endSeconds: 4258,
        },
        suggestedSegment: {
          startSeconds: 4238,
          endSeconds: 4251,
          setupPaddingSeconds: 4,
          resolutionPaddingSeconds: 7,
          trimDeadAirApplied: true,
        },
        confidenceBand: "HIGH",
        scoreEstimate: 0.88,
        reasonCodes: [
          "OVERLAP_SPIKE",
          "LAUGHTER_BURST",
          "STRUCTURE_CONSEQUENCE",
        ],
        transcriptSnippet: "we survived that by inches",
        scoreBreakdown: [
          {
            reasonCode: "OVERLAP_SPIKE",
            label: "Overlapping speech spike",
            contribution: 0.3,
            direction: "POSITIVE",
          },
          {
            reasonCode: "LAUGHTER_BURST",
            label: "Laughter-like burst",
            contribution: 0.27,
            direction: "POSITIVE",
          },
          {
            reasonCode: "STRUCTURE_CONSEQUENCE",
            label: "Consequence immediately follows action",
            contribution: 0.22,
            direction: "POSITIVE",
          },
        ],
        contextRequired: false,
        editableLabel: "Near-wipe recovery",
      },
      {
        id: "candidate_004",
        candidateWindow: {
          startSeconds: 6104,
          endSeconds: 6136,
        },
        suggestedSegment: {
          startSeconds: 6110,
          endSeconds: 6124,
          setupPaddingSeconds: 6,
          resolutionPaddingSeconds: 6,
          trimDeadAirApplied: false,
        },
        confidenceBand: "EXPERIMENTAL",
        scoreEstimate: 0.41,
        reasonCodes: ["CONTEXT_REQUIRED", "STRUCTURE_SETUP", "LOW_INFORMATION"],
        transcriptSnippet:
          "this might be bad unless that puzzle path loops back",
        scoreBreakdown: [
          {
            reasonCode: "STRUCTURE_SETUP",
            label: "Promising setup language",
            contribution: 0.18,
            direction: "POSITIVE",
          },
          {
            reasonCode: "CONTEXT_REQUIRED",
            label: "Needs surrounding context",
            contribution: -0.07,
            direction: "NEGATIVE",
          },
          {
            reasonCode: "LOW_INFORMATION",
            label: "Weak supporting signal density",
            contribution: -0.1,
            direction: "NEGATIVE",
          },
        ],
        contextRequired: true,
        editableLabel: "Puzzle tension setup",
      },
    ],
    reviewDecisions: [],
    createdAt: "2026-03-13T09:00:00.000Z",
    updatedAt: "2026-03-13T09:05:00.000Z",
  });
}

export function createMockProjectSessions(): ProjectSession[] {
  const primary = createMockProjectSession();

  return [
    primary,
    projectSessionSchema.parse({
      ...primary,
      id: "session_demo_stealth",
      title: "Stealth Route Discovery",
      profileId: "stealth",
      status: "READY",
      mediaSource: {
        ...primary.mediaSource,
        id: "media_demo_002",
        path: "/Users/jason_marshall/VODs/stealth-route-2026-03-09.mp4",
        fileName: "stealth-route-2026-03-09.mp4",
        format: "mp4",
        durationSeconds: 6420,
      },
      candidates: primary.candidates.slice(0, 2).map((candidate, index) => ({
        ...candidate,
        id: `stealth_candidate_${index + 1}`,
        confidenceBand: index === 0 ? "MEDIUM" : "LOW",
        editableLabel:
          index === 0 ? "Alert dodge setup" : "Experimental flank path",
      })),
      reviewDecisions: [],
      createdAt: "2026-03-14T11:00:00.000Z",
      updatedAt: "2026-03-14T11:12:00.000Z",
    }),
    projectSessionSchema.parse({
      ...primary,
      id: "session_demo_exploration",
      title: "Exploration Puzzle Sweep",
      profileId: "exploration",
      status: "REVIEWING",
      mediaSource: {
        ...primary.mediaSource,
        id: "media_demo_003",
        path: "/Users/jason_marshall/VODs/puzzle-sweep-2026-03-10.mov",
        fileName: "puzzle-sweep-2026-03-10.mov",
        format: "mov",
        durationSeconds: 4890,
      },
      candidates: primary.candidates.slice(1, 4).map((candidate, index) => ({
        ...candidate,
        id: `exploration_candidate_${index + 1}`,
        editableLabel:
          index === 0
            ? "Clue reveal"
            : index === 1
              ? "Route realization"
              : "Context-heavy setup",
      })),
      reviewDecisions: [],
      createdAt: "2026-03-15T08:18:00.000Z",
      updatedAt: "2026-03-15T08:42:00.000Z",
    }),
  ];
}

export function createMockReviewHistory(): ReviewDecision[] {
  return [
    {
      id: "review_accept_001",
      projectSessionId: "session_demo_local",
      candidateId: "candidate_001",
      action: "ACCEPT",
      label: "Clutch escape payoff",
      createdAt: "2026-03-13T09:15:00.000Z",
    },
    {
      id: "review_relabel_001",
      projectSessionId: "session_demo_local",
      candidateId: "candidate_003",
      action: "RELABEL",
      label: "Near-wipe recovery",
      createdAt: "2026-03-13T09:18:00.000Z",
    },
  ];
}
