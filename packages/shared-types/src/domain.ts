import { z } from "zod";

export const confidenceBandSchema = z.enum([
  "HIGH",
  "MEDIUM",
  "LOW",
  "EXPERIMENTAL",
]);

export const reasonCodeSchema = z.enum([
  "LOUDNESS_SPIKE",
  "LAUGHTER_BURST",
  "OVERLAP_SPIKE",
  "REACTION_PHRASE",
  "COMMENTARY_DENSITY",
  "SILENCE_BREAK",
  "ACTION_AUDIO_CLUSTER",
  "STRUCTURE_SETUP",
  "STRUCTURE_CONSEQUENCE",
  "STRUCTURE_RESOLUTION",
  "MENU_HEAVY",
  "CLEANUP_HEAVY",
  "LOW_INFORMATION",
  "CONTEXT_REQUIRED",
  "TACTICAL_NARRATION",
  "PITCH_EXCURSION",
  "ABRUPT_SILENCE_AFTER_INTENSITY",
]);

export const reviewActionSchema = z.enum([
  "PENDING",
  "ACCEPT",
  "REJECT",
  "RETIME",
  "RELABEL",
]);

export const reviewTagSchema = z.enum([
  "DEAD_AIR_RISK",
  "CLEANUP_RISK",
  "MENU_RISK",
  "LOW_INFORMATION_RISK",
]);

export const analysisCoverageBandSchema = z.enum(["STRONG", "PARTIAL", "THIN"]);

export const analysisCoverageFlagSchema = z.enum([
  "METADATA_FALLBACK_USED",
  "SEEDED_TRANSCRIPT",
  "TRANSCRIPT_SPARSE",
  "LOW_CANDIDATE_COUNT",
  "NO_CANDIDATES",
]);

export const analysisCoverageSchema = z.object({
  band: analysisCoverageBandSchema,
  note: z.string(),
  flags: z.array(analysisCoverageFlagSchema).default([]),
});

export const defaultAnalysisCoverage = {
  band: "PARTIAL",
  note: "Coverage note unavailable for this session.",
  flags: [],
} satisfies z.input<typeof analysisCoverageSchema>;

export const timeRangeSchema = z
  .object({
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().nonnegative(),
  })
  .refine((value) => value.endSeconds > value.startSeconds, {
    message: "endSeconds must be greater than startSeconds",
  });

export const mediaSourceSchema = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.enum(["VIDEO", "AUDIO"]),
  fileName: z.string(),
  durationSeconds: z.number().positive(),
  format: z.string(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  frameRate: z.number().positive().optional(),
  ingestNotes: z.array(z.string()).default([]),
});

export const transcriptChunkSchema = z.object({
  id: z.string(),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  text: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export const speechRegionSchema = z.object({
  id: z.string(),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  speechDensity: z.number().min(0).max(1),
  overlapActivity: z.number().min(0).max(1),
});

export const featureWindowSchema = z.object({
  id: z.string(),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  rmsLoudness: z.number().min(0).max(1),
  onsetDensity: z.number().min(0).max(1),
  spectralContrast: z.number().min(0).max(1),
  zeroCrossingRate: z.number().min(0).max(1),
  speechDensity: z.number().min(0).max(1),
  overlapActivity: z.number().min(0).max(1),
  laughterLikeBurst: z.number().min(0).max(1),
  pitchExcursion: z.number().min(0).max(1),
  abruptSilenceAfterIntensity: z.number().min(0).max(1),
});

export const scoreContributionSchema = z.object({
  reasonCode: reasonCodeSchema,
  label: z.string(),
  contribution: z.number(),
  direction: z.enum(["POSITIVE", "NEGATIVE"]),
});

export const suggestedSegmentSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  setupPaddingSeconds: z.number().nonnegative(),
  resolutionPaddingSeconds: z.number().nonnegative(),
  trimDeadAirApplied: z.boolean(),
});

export const candidateWindowSchema = z.object({
  id: z.string(),
  candidateWindow: timeRangeSchema,
  suggestedSegment: suggestedSegmentSchema,
  confidenceBand: confidenceBandSchema,
  scoreEstimate: z.number().min(0).max(1),
  reasonCodes: z.array(reasonCodeSchema).min(1),
  transcriptSnippet: z.string(),
  scoreBreakdown: z.array(scoreContributionSchema).min(1),
  contextRequired: z.boolean().default(false),
  editableLabel: z.string(),
  reviewTags: z.array(reviewTagSchema).default([]),
  profileMatches: z
    .array(z.lazy(() => candidateProfileMatchSchema))
    .default([]),
});

export const reviewDecisionSchema = z.object({
  id: z.string(),
  projectSessionId: z.string(),
  candidateId: z.string(),
  action: reviewActionSchema,
  label: z.string().optional(),
  adjustedSegment: timeRangeSchema.optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
});

export const exampleClipSourceTypeSchema = z.enum([
  "TWITCH_CLIP_URL",
  "YOUTUBE_SHORT_URL",
  "LOCAL_FILE_UPLOAD",
  "LOCAL_FILE_PATH",
]);

export const exampleClipStatusSchema = z.enum([
  "REFERENCE_ONLY",
  "LOCAL_FILE_AVAILABLE",
  "MISSING_LOCAL_FILE",
]);

export const mediaLibraryAssetTypeSchema = z.enum(["CLIP", "VOD", "EDIT"]);

export const mediaLibraryAssetScopeSchema = z.enum(["GLOBAL", "PROFILE"]);

export const mediaEditPairStatusSchema = z.enum(["READY", "INCOMPLETE"]);

export const mediaIndexJobStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export const mediaIndexArtifactKindSchema = z.enum(["AUDIO_FINGERPRINT"]);

export const mediaIndexArtifactMethodSchema = z.enum([
  "BYTE_SAMPLED_AUDIO_PROXY_V1",
  "DECODED_AUDIO_FINGERPRINT_V1",
]);

export const mediaAlignmentJobStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export const mediaAlignmentMethodSchema = z.enum([
  "AUDIO_PROXY_BUCKET_CORRELATION_V1",
  "DECODED_AUDIO_BUCKET_CORRELATION_V1",
]);

export const mediaAlignmentMatchKindSchema = z.enum([
  "EDIT_TO_VOD_KEEP",
  "CLIP_TO_VOD_MATCH",
]);

export const mediaEditAlignmentKindSchema = z.enum([
  "PROVISIONAL_KEEP",
  "PROVISIONAL_REMOVED_POOL",
  "CONFIRMED_KEEP",
  "CONFIRMED_REMOVED",
]);

export const mediaEditAlignmentMethodSchema = z.enum([
  "RUNTIME_PROPORTIONAL_ESTIMATE",
  "AUDIO_PROXY_ALIGNMENT",
  "DECODED_AUDIO_ALIGNMENT",
  "MANUAL",
]);

export const profileMatchingMethodSchema = z.enum([
  "NONE",
  "LOCAL_FILE_HEURISTIC",
]);

export const exampleClipFeatureSummarySchema = z.object({
  methodVersion: z.enum(["LOCAL_FILE_HEURISTIC_V1", "LOCAL_FILE_HEURISTIC_V2"]),
  generatedAt: z.string(),
  durationSeconds: z.number().positive(),
  transcriptChunkCount: z.number().int().nonnegative(),
  transcriptDensityPerMinute: z.number().nonnegative(),
  candidateSeedCount: z.number().int().nonnegative(),
  candidateDensityPerMinute: z.number().nonnegative(),
  transcriptAnchorTerms: z.array(z.string()).default([]),
  transcriptAnchorPhrases: z.array(z.string()).default([]),
  speechDensityMean: z.number().min(0).max(1),
  speechDensityPeak: z.number().min(0).max(1),
  energyMean: z.number().min(0).max(1),
  energyPeak: z.number().min(0).max(1),
  pacingMean: z.number().min(0).max(1),
  overlapActivityMean: z.number().min(0).max(1),
  highActivityShare: z.number().min(0).max(1),
  topReasonCodes: z.array(reasonCodeSchema).default([]),
  coverageBand: analysisCoverageBandSchema,
  coverageFlags: z.array(analysisCoverageFlagSchema).default([]),
});

export const mediaIndexSummarySchema = z.object({
  methodVersion: z.enum(["MEDIA_INDEX_V1"]),
  generatedAt: z.string(),
  sourcePath: z.string(),
  fileName: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  kind: z.enum(["VIDEO", "AUDIO"]),
  format: z.string(),
  durationSeconds: z.number().positive(),
  frameRate: z.number().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  videoCodec: z.string().optional(),
  audioCodec: z.string().optional(),
  hasVideo: z.boolean(),
  hasAudio: z.boolean(),
  streamCount: z.number().int().nonnegative(),
  notes: z.array(z.string()).default([]),
});

export const mediaIndexAudioBucketSchema = z.object({
  index: z.number().int().nonnegative(),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  energyScore: z.number().min(0).max(1),
  onsetScore: z.number().min(0).max(1),
  spectralFluxScore: z.number().min(0).max(1),
  silenceScore: z.number().min(0).max(1),
  fingerprint: z.string(),
});

export const mediaIndexArtifactSummarySchema = z.object({
  latestAudioFingerprintArtifactId: z.string().optional(),
  audioFingerprintBucketCount: z.number().int().nonnegative().default(0),
  audioFingerprintMethod: mediaIndexArtifactMethodSchema.optional(),
  audioFingerprintUpdatedAt: z.string().optional(),
  bucketDurationSeconds: z.number().positive().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
});

export const mediaIndexArtifactSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  jobId: z.string().optional(),
  kind: mediaIndexArtifactKindSchema,
  method: mediaIndexArtifactMethodSchema,
  bucketDurationSeconds: z.number().positive(),
  durationSeconds: z.number().positive(),
  bucketCount: z.number().int().nonnegative(),
  confidenceScore: z.number().min(0).max(1),
  payloadByteSize: z.number().int().nonnegative(),
  energyMean: z.number().min(0).max(1),
  energyPeak: z.number().min(0).max(1),
  onsetMean: z.number().min(0).max(1),
  silenceShare: z.number().min(0).max(1),
  buckets: z.array(mediaIndexAudioBucketSchema),
  note: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const exampleClipSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  sourceType: exampleClipSourceTypeSchema,
  sourceValue: z.string(),
  title: z.string().optional(),
  note: z.string().optional(),
  status: exampleClipStatusSchema.default("REFERENCE_ONLY"),
  statusDetail: z.string().optional(),
  featureSummary: exampleClipFeatureSummarySchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const mediaLibraryAssetSchema = z.object({
  id: z.string(),
  assetType: mediaLibraryAssetTypeSchema,
  scope: mediaLibraryAssetScopeSchema,
  profileId: z.string().optional(),
  sourceType: exampleClipSourceTypeSchema,
  sourceValue: z.string(),
  title: z.string().optional(),
  note: z.string().optional(),
  status: exampleClipStatusSchema.default("REFERENCE_ONLY"),
  statusDetail: z.string().optional(),
  featureSummary: exampleClipFeatureSummarySchema.optional(),
  indexSummary: mediaIndexSummarySchema.optional(),
  indexArtifactSummary: mediaIndexArtifactSummarySchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const mediaIndexJobSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  status: mediaIndexJobStatusSchema,
  progress: z.number().min(0).max(1),
  statusDetail: z.string(),
  errorMessage: z.string().optional(),
  result: mediaIndexSummarySchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  cancelledAt: z.string().optional(),
});

export const mediaAlignmentBucketMatchSchema = z.object({
  queryBucketIndex: z.number().int().nonnegative(),
  sourceBucketIndex: z.number().int().nonnegative(),
  score: z.number().min(0).max(1),
});

export const mediaAlignmentMatchSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  pairId: z.string().optional(),
  sourceAssetId: z.string(),
  queryAssetId: z.string(),
  kind: mediaAlignmentMatchKindSchema,
  method: mediaAlignmentMethodSchema,
  sourceRange: timeRangeSchema,
  queryRange: timeRangeSchema,
  score: z.number().min(0).max(1),
  confidenceScore: z.number().min(0).max(1),
  matchedBucketCount: z.number().int().nonnegative(),
  totalQueryBucketCount: z.number().int().nonnegative(),
  bucketMatches: z.array(mediaAlignmentBucketMatchSchema).default([]),
  note: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const mediaAlignmentJobSchema = z.object({
  id: z.string(),
  pairId: z.string().optional(),
  sourceAssetId: z.string(),
  queryAssetId: z.string(),
  status: mediaAlignmentJobStatusSchema,
  progress: z.number().min(0).max(1),
  statusDetail: z.string(),
  errorMessage: z.string().optional(),
  method: mediaAlignmentMethodSchema,
  matchCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  cancelledAt: z.string().optional(),
});

export const mediaEditAlignmentSegmentSchema = z.object({
  id: z.string(),
  kind: mediaEditAlignmentKindSchema,
  method: mediaEditAlignmentMethodSchema,
  sourceRange: timeRangeSchema.optional(),
  editRange: timeRangeSchema.optional(),
  estimatedSourceSeconds: z.number().nonnegative().optional(),
  estimatedEditSeconds: z.number().nonnegative().optional(),
  confidenceScore: z.number().min(0).max(1),
  note: z.string(),
});

export const mediaEditPairSchema = z.object({
  id: z.string(),
  vodAssetId: z.string(),
  editAssetId: z.string(),
  profileId: z.string().optional(),
  title: z.string().optional(),
  note: z.string().optional(),
  status: mediaEditPairStatusSchema,
  statusDetail: z.string(),
  sourceDurationSeconds: z.number().positive().optional(),
  editDurationSeconds: z.number().positive().optional(),
  keptDurationSeconds: z.number().nonnegative().optional(),
  removedDurationSeconds: z.number().nonnegative().optional(),
  keepRatio: z.number().min(0).max(1).optional(),
  compressionRatio: z.number().positive().optional(),
  alignmentSegments: z.array(mediaEditAlignmentSegmentSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const candidateProfileMatchStatusSchema = z.enum([
  "UNASSESSED",
  "PLACEHOLDER",
  "HEURISTIC",
  "EXAMPLE_COMPARISON",
]);

export const candidateProfileMatchStrengthSchema = z.enum([
  "UNASSESSED",
  "STRONG",
  "POSSIBLE",
  "WEAK",
]);

export const candidateProfileMatchSchema = z.object({
  profileId: z.string(),
  method: profileMatchingMethodSchema.default("NONE"),
  status: candidateProfileMatchStatusSchema,
  strength: candidateProfileMatchStrengthSchema,
  note: z.string(),
  matchedExampleClipIds: z.array(z.string()).default([]),
  comparedExampleCount: z.number().int().nonnegative().default(0),
  supportingFactors: z.array(z.string()).default([]),
  limitingFactors: z.array(z.string()).default([]),
  similarityScore: z.number().min(0).max(1).optional(),
  updatedAt: z.string().optional(),
});

export const profileStateSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const profileSourceSchema = z.enum(["SYSTEM", "USER"]);

export const profilePresentationModeSchema = z.enum([
  "ALL_CANDIDATES",
  "PROFILE_VIEW",
  "STRONG_MATCHES",
]);

export const clipProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  description: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: profileStateSchema.default("ACTIVE"),
  source: profileSourceSchema.default("USER"),
  mode: z
    .enum(["BROAD", "FOCUSED", "CONTEXTUAL", "EXAMPLE_DRIVEN"])
    .default("EXAMPLE_DRIVEN"),
  signalWeights: z.record(z.string(), z.number()).default({}),
  exampleClips: z.array(exampleClipSchema).default([]),
});

export const contentProfileSchema = clipProfileSchema;

export const profileMatchingSummarySchema = z.object({
  profileId: z.string(),
  totalExampleCount: z.number().int().nonnegative(),
  usableLocalExampleCount: z.number().int().nonnegative(),
  referenceOnlyExampleCount: z.number().int().nonnegative(),
  unavailableLocalExampleCount: z.number().int().nonnegative(),
  ready: z.boolean(),
  method: profileMatchingMethodSchema,
  note: z.string(),
});

export const settingsSchema = z.object({
  microWindowSeconds: z.number().positive(),
  candidateWindowMinSeconds: z.number().positive(),
  candidateWindowMaxSeconds: z.number().positive(),
  suggestedSetupPaddingSeconds: z.number().nonnegative(),
  suggestedResolutionPaddingSeconds: z.number().nonnegative(),
  experimentalCandidateQuota: z.number().int().nonnegative(),
  transcriptProvider: z.string(),
  runOfflineOnly: z.boolean(),
});

export const projectSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["IDLE", "ANALYZING", "READY", "REVIEWING"]),
  mediaSource: mediaSourceSchema,
  analysisCoverage: analysisCoverageSchema.default(defaultAnalysisCoverage),
  profileId: z.string(),
  settings: settingsSchema,
  transcript: z.array(transcriptChunkSchema),
  speechRegions: z.array(speechRegionSchema),
  featureWindows: z.array(featureWindowSchema),
  candidates: z.array(candidateWindowSchema),
  reviewDecisions: z.array(reviewDecisionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const projectSessionSummarySchema = z.object({
  sessionId: z.string(),
  sessionTitle: z.string(),
  sourcePath: z.string(),
  sourceName: z.string(),
  status: z.enum(["IDLE", "ANALYZING", "READY", "REVIEWING"]),
  analysisCoverage: analysisCoverageSchema.default(defaultAnalysisCoverage),
  profileId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  candidateCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
});

export type ConfidenceBand = z.infer<typeof confidenceBandSchema>;
export type ReasonCode = z.infer<typeof reasonCodeSchema>;
export type ReviewAction = z.infer<typeof reviewActionSchema>;
export type ReviewTag = z.infer<typeof reviewTagSchema>;
export type AnalysisCoverageBand = z.infer<typeof analysisCoverageBandSchema>;
export type AnalysisCoverageFlag = z.infer<typeof analysisCoverageFlagSchema>;
export type AnalysisCoverage = z.infer<typeof analysisCoverageSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;
export type MediaSource = z.infer<typeof mediaSourceSchema>;
export type TranscriptChunk = z.infer<typeof transcriptChunkSchema>;
export type SpeechRegion = z.infer<typeof speechRegionSchema>;
export type FeatureWindow = z.infer<typeof featureWindowSchema>;
export type ScoreContribution = z.infer<typeof scoreContributionSchema>;
export type SuggestedSegment = z.infer<typeof suggestedSegmentSchema>;
export type CandidateWindow = z.infer<typeof candidateWindowSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type ExampleClipSourceType = z.infer<typeof exampleClipSourceTypeSchema>;
export type ExampleClipStatus = z.infer<typeof exampleClipStatusSchema>;
export type MediaLibraryAssetType = z.infer<
  typeof mediaLibraryAssetTypeSchema
>;
export type MediaLibraryAssetScope = z.infer<
  typeof mediaLibraryAssetScopeSchema
>;
export type MediaEditPairStatus = z.infer<typeof mediaEditPairStatusSchema>;
export type MediaIndexJobStatus = z.infer<typeof mediaIndexJobStatusSchema>;
export type MediaIndexArtifactKind = z.infer<
  typeof mediaIndexArtifactKindSchema
>;
export type MediaIndexArtifactMethod = z.infer<
  typeof mediaIndexArtifactMethodSchema
>;
export type MediaAlignmentJobStatus = z.infer<
  typeof mediaAlignmentJobStatusSchema
>;
export type MediaAlignmentMethod = z.infer<typeof mediaAlignmentMethodSchema>;
export type MediaAlignmentMatchKind = z.infer<
  typeof mediaAlignmentMatchKindSchema
>;
export type MediaEditAlignmentKind = z.infer<
  typeof mediaEditAlignmentKindSchema
>;
export type MediaEditAlignmentMethod = z.infer<
  typeof mediaEditAlignmentMethodSchema
>;
export type ProfileMatchingMethod = z.infer<typeof profileMatchingMethodSchema>;
export type ExampleClipFeatureSummary = z.infer<
  typeof exampleClipFeatureSummarySchema
>;
export type ExampleClip = z.infer<typeof exampleClipSchema>;
export type MediaIndexSummary = z.infer<typeof mediaIndexSummarySchema>;
export type MediaIndexAudioBucket = z.infer<
  typeof mediaIndexAudioBucketSchema
>;
export type MediaIndexArtifactSummary = z.infer<
  typeof mediaIndexArtifactSummarySchema
>;
export type MediaIndexArtifact = z.infer<typeof mediaIndexArtifactSchema>;
export type MediaLibraryAsset = z.infer<typeof mediaLibraryAssetSchema>;
export type MediaIndexJob = z.infer<typeof mediaIndexJobSchema>;
export type MediaAlignmentBucketMatch = z.infer<
  typeof mediaAlignmentBucketMatchSchema
>;
export type MediaAlignmentMatch = z.infer<typeof mediaAlignmentMatchSchema>;
export type MediaAlignmentJob = z.infer<typeof mediaAlignmentJobSchema>;
export type MediaEditAlignmentSegment = z.infer<
  typeof mediaEditAlignmentSegmentSchema
>;
export type MediaEditPair = z.infer<typeof mediaEditPairSchema>;
export type CandidateProfileMatchStatus = z.infer<
  typeof candidateProfileMatchStatusSchema
>;
export type CandidateProfileMatchStrength = z.infer<
  typeof candidateProfileMatchStrengthSchema
>;
export type CandidateProfileMatch = z.infer<typeof candidateProfileMatchSchema>;
export type ProfileState = z.infer<typeof profileStateSchema>;
export type ProfileSource = z.infer<typeof profileSourceSchema>;
export type ProfilePresentationMode = z.infer<
  typeof profilePresentationModeSchema
>;
export type ClipProfile = z.infer<typeof clipProfileSchema>;
export type ContentProfile = z.infer<typeof contentProfileSchema>;
export type ProfileMatchingSummary = z.infer<
  typeof profileMatchingSummarySchema
>;
export type Settings = z.infer<typeof settingsSchema>;
export type ProjectSession = z.infer<typeof projectSessionSchema>;
export type ProjectSessionSummary = z.infer<typeof projectSessionSummarySchema>;

export type CandidateDecisionMap = Record<string, ReviewDecision | undefined>;

export const defaultSettings: Settings = {
  microWindowSeconds: 2,
  candidateWindowMinSeconds: 15,
  candidateWindowMaxSeconds: 45,
  suggestedSetupPaddingSeconds: 6,
  suggestedResolutionPaddingSeconds: 8,
  experimentalCandidateQuota: 2,
  transcriptProvider: "stub-local",
  runOfflineOnly: true,
};
