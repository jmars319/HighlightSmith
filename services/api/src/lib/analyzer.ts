import {
  addExampleClipRequestSchema,
  analyzeProjectRequestSchema,
  cancelMediaAlignmentJobRequestSchema,
  cancelMediaIndexJobRequestSchema,
  clipProfileSchema,
  createMediaAlignmentJobRequestSchema,
  createMediaEditPairRequestSchema,
  createMediaIndexJobRequestSchema,
  createMediaLibraryAssetRequestSchema,
  createClipProfileRequestSchema,
  exampleClipSchema,
  mediaEditPairSchema,
  mediaAlignmentJobSchema,
  mediaAlignmentMatchSchema,
  mediaIndexArtifactSchema,
  mediaIndexJobSchema,
  mediaLibraryAssetSchema,
  projectSessionSchema,
  projectSessionSummarySchema,
  replaceMediaThumbnailOutputsRequestSchema,
  reviewUpdateRequestSchema,
  type AddExampleClipRequest,
  type AnalyzeProjectRequest,
  type CancelMediaAlignmentJobRequest,
  type CancelMediaIndexJobRequest,
  type ClipProfile,
  type CreateMediaAlignmentJobRequest,
  type CreateMediaEditPairRequest,
  type CreateMediaIndexJobRequest,
  type CreateMediaLibraryAssetRequest,
  type CreateClipProfileRequest,
  type ExampleClip,
  type MediaEditPair,
  type MediaAlignmentJob,
  type MediaAlignmentMatch,
  type MediaIndexArtifact,
  type MediaIndexJob,
  type MediaLibraryAsset,
  type ProjectSession,
  type ProjectSessionSummary,
  type ReplaceMediaThumbnailOutputsRequest,
  type ReviewUpdateRequest,
} from "@vaexcore/pulse-shared-types";

export class AnalyzerBridgeError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

type ZodIssueLike = {
  path?: Array<string | number>;
  message?: string;
};

function isZodErrorLike(
  value: unknown,
): value is Error & { issues: ZodIssueLike[] } {
  if (!(value instanceof Error) || value.name !== "ZodError") {
    return false;
  }

  const issues = (value as { issues?: unknown }).issues;
  return Array.isArray(issues);
}

export function getAnalyzerUrl() {
  return process.env.VAEXCORE_PULSE_ANALYZER_URL ?? "http://127.0.0.1:9010";
}

function getAnalyzerTimeoutMs() {
  const rawValue = Number(process.env.VAEXCORE_PULSE_ANALYZER_TIMEOUT_MS);
  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 15_000;
}

type AnalyzerSessionEnvelope = {
  message?: string;
  session?: unknown;
};

type AnalyzerSessionListEnvelope = {
  message?: string;
  sessions?: unknown;
};

type AnalyzerProfileEnvelope = {
  message?: string;
  profile?: unknown;
};

type AnalyzerProfileListEnvelope = {
  message?: string;
  profiles?: unknown;
};

type AnalyzerExampleEnvelope = {
  message?: string;
  example?: unknown;
};

type AnalyzerExampleListEnvelope = {
  message?: string;
  examples?: unknown;
};

type AnalyzerAssetEnvelope = {
  message?: string;
  asset?: unknown;
};

type AnalyzerAssetListEnvelope = {
  message?: string;
  assets?: unknown;
};

type AnalyzerPairEnvelope = {
  message?: string;
  pair?: unknown;
};

type AnalyzerPairListEnvelope = {
  message?: string;
  pairs?: unknown;
};

type AnalyzerIndexJobEnvelope = {
  message?: string;
  job?: unknown;
};

type AnalyzerIndexJobListEnvelope = {
  message?: string;
  jobs?: unknown;
};

type AnalyzerIndexArtifactListEnvelope = {
  message?: string;
  artifacts?: unknown;
};

type AnalyzerAlignmentJobEnvelope = {
  message?: string;
  job?: unknown;
};

type AnalyzerAlignmentJobListEnvelope = {
  message?: string;
  jobs?: unknown;
};

type AnalyzerAlignmentMatchListEnvelope = {
  message?: string;
  matches?: unknown;
};

function parseWithSchema<T>(schemaName: string, parser: () => T): T {
  try {
    return parser();
  } catch (error) {
    if (isZodErrorLike(error)) {
      const firstIssue = error.issues[0];
      const issuePathParts = firstIssue?.path ?? [];
      const issuePath = issuePathParts.length
        ? issuePathParts.join(".")
        : schemaName;
      throw new AnalyzerBridgeError(
        `Analyzer returned an invalid ${schemaName} payload at ${issuePath}: ${firstIssue?.message ?? "schema mismatch"}`,
        502,
      );
    }

    throw error;
  }
}

async function fetchAnalyzer(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const timeoutMs = getAnalyzerTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${getAnalyzerUrl()}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AnalyzerBridgeError(
        `Analyzer request timed out after ${Math.ceil(timeoutMs / 1000)}s`,
        504,
      );
    }

    throw new AnalyzerBridgeError(
      error instanceof Error
        ? `Unable to reach analyzer at ${getAnalyzerUrl()}: ${error.message}`
        : `Unable to reach analyzer at ${getAnalyzerUrl()}`,
      502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseSessionResponse(
  response: Response,
): Promise<ProjectSession> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerSessionEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("session", () =>
    projectSessionSchema.parse(payload?.session),
  );
}

async function parseSessionSummaryListResponse(
  response: Response,
): Promise<ProjectSessionSummary[]> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerSessionListEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("sessions", () =>
    projectSessionSummarySchema.array().parse(payload?.sessions),
  );
}

async function parseProfileResponse(response: Response): Promise<ClipProfile> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerProfileEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("profile", () =>
    clipProfileSchema.parse(payload?.profile),
  );
}

async function parseProfileListResponse(
  response: Response,
): Promise<ClipProfile[]> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerProfileListEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("profiles", () =>
    clipProfileSchema.array().parse(payload?.profiles),
  );
}

async function parseExampleResponse(response: Response): Promise<ExampleClip> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerExampleEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("example", () =>
    exampleClipSchema.parse(payload?.example),
  );
}

async function parseExampleListResponse(
  response: Response,
): Promise<ExampleClip[]> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerExampleListEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("examples", () =>
    exampleClipSchema.array().parse(payload?.examples),
  );
}

async function parseAssetResponse(
  response: Response,
): Promise<MediaLibraryAsset> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerAssetEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("asset", () =>
    mediaLibraryAssetSchema.parse(payload?.asset),
  );
}

async function parseAssetListResponse(
  response: Response,
): Promise<MediaLibraryAsset[]> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerAssetListEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("assets", () =>
    mediaLibraryAssetSchema.array().parse(payload?.assets),
  );
}

async function parsePairResponse(response: Response): Promise<MediaEditPair> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerPairEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("pair", () =>
    mediaEditPairSchema.parse(payload?.pair),
  );
}

async function parsePairListResponse(
  response: Response,
): Promise<MediaEditPair[]> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerPairListEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("pairs", () =>
    mediaEditPairSchema.array().parse(payload?.pairs),
  );
}

async function parseIndexJobResponse(
  response: Response,
): Promise<MediaIndexJob> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerIndexJobEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("index job", () =>
    mediaIndexJobSchema.parse(payload?.job),
  );
}

async function parseIndexJobListResponse(
  response: Response,
): Promise<MediaIndexJob[]> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerIndexJobListEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("index jobs", () =>
    mediaIndexJobSchema.array().parse(payload?.jobs),
  );
}

async function parseIndexArtifactListResponse(
  response: Response,
): Promise<MediaIndexArtifact[]> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerIndexArtifactListEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("index artifacts", () =>
    mediaIndexArtifactSchema.array().parse(payload?.artifacts),
  );
}

async function parseAlignmentJobResponse(
  response: Response,
): Promise<MediaAlignmentJob> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerAlignmentJobEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("alignment job", () =>
    mediaAlignmentJobSchema.parse(payload?.job),
  );
}

async function parseAlignmentJobListResponse(
  response: Response,
): Promise<MediaAlignmentJob[]> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerAlignmentJobListEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("alignment jobs", () =>
    mediaAlignmentJobSchema.array().parse(payload?.jobs),
  );
}

async function parseAlignmentMatchListResponse(
  response: Response,
): Promise<MediaAlignmentMatch[]> {
  const payload = (await response
    .json()
    .catch(() => null)) as AnalyzerAlignmentMatchListEnvelope | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  return parseWithSchema("alignment matches", () =>
    mediaAlignmentMatchSchema.array().parse(payload?.matches),
  );
}

export async function requestAnalyzerSession(
  input: AnalyzeProjectRequest,
): Promise<ProjectSession> {
  const request = analyzeProjectRequestSchema.parse(input);
  const response = await fetchAnalyzer("/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sourcePath: request.sourcePath,
      profileId: request.profileId ?? "generic",
      sessionTitle: request.sessionTitle,
      persist: true,
    }),
  });

  return parseSessionResponse(response);
}

export async function requestStoredSession(
  sessionId: string,
): Promise<ProjectSession> {
  const response = await fetchAnalyzer(
    `/session/${encodeURIComponent(sessionId)}`,
  );
  return parseSessionResponse(response);
}

export async function requestSessionSummaries(): Promise<
  ProjectSessionSummary[]
> {
  const response = await fetchAnalyzer("/sessions");
  return parseSessionSummaryListResponse(response);
}

export async function requestProfiles(): Promise<ClipProfile[]> {
  const response = await fetchAnalyzer("/profiles");
  return parseProfileListResponse(response);
}

export async function createProfile(
  input: CreateClipProfileRequest,
): Promise<ClipProfile> {
  const request = createClipProfileRequestSchema.parse(input);
  const response = await fetchAnalyzer("/profiles", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return parseProfileResponse(response);
}

export async function requestProfileExamples(
  profileId: string,
): Promise<ExampleClip[]> {
  const response = await fetchAnalyzer(
    `/profiles/${encodeURIComponent(profileId)}/examples`,
  );
  return parseExampleListResponse(response);
}

export async function addProfileExample(
  profileId: string,
  input: AddExampleClipRequest,
): Promise<ExampleClip> {
  const request = addExampleClipRequestSchema.parse(input);
  const response = await fetchAnalyzer(
    `/profiles/${encodeURIComponent(profileId)}/examples`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  return parseExampleResponse(response);
}

export async function requestMediaLibraryAssets(): Promise<
  MediaLibraryAsset[]
> {
  const response = await fetchAnalyzer("/library/assets");
  return parseAssetListResponse(response);
}

export async function createMediaLibraryAsset(
  input: CreateMediaLibraryAssetRequest,
): Promise<MediaLibraryAsset> {
  const request = createMediaLibraryAssetRequestSchema.parse(input);
  const response = await fetchAnalyzer("/library/assets", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return parseAssetResponse(response);
}

export async function replaceMediaThumbnailOutputs(
  assetId: string,
  input: ReplaceMediaThumbnailOutputsRequest,
): Promise<MediaLibraryAsset> {
  const request = replaceMediaThumbnailOutputsRequestSchema.parse(input);
  const response = await fetchAnalyzer(
    `/library/assets/${encodeURIComponent(assetId)}/thumbnail-outputs`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  return parseAssetResponse(response);
}

export async function requestMediaEditPairs(): Promise<MediaEditPair[]> {
  const response = await fetchAnalyzer("/library/pairs");
  return parsePairListResponse(response);
}

export async function createMediaEditPair(
  input: CreateMediaEditPairRequest,
): Promise<MediaEditPair> {
  const request = createMediaEditPairRequestSchema.parse(input);
  const response = await fetchAnalyzer("/library/pairs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return parsePairResponse(response);
}

export async function requestMediaIndexJobs(): Promise<MediaIndexJob[]> {
  const response = await fetchAnalyzer("/library/index-jobs");
  return parseIndexJobListResponse(response);
}

export async function requestMediaIndexArtifacts(
  assetId?: string,
): Promise<MediaIndexArtifact[]> {
  const response = await fetchAnalyzer(
    assetId
      ? `/library/assets/${encodeURIComponent(assetId)}/index-artifacts`
      : "/library/index-artifacts",
  );
  return parseIndexArtifactListResponse(response);
}

export async function requestMediaAlignmentJobs(): Promise<
  MediaAlignmentJob[]
> {
  const response = await fetchAnalyzer("/library/alignment-jobs");
  return parseAlignmentJobListResponse(response);
}

export async function requestMediaAlignmentMatches(
  pairId?: string,
): Promise<MediaAlignmentMatch[]> {
  const response = await fetchAnalyzer(
    pairId
      ? `/library/pairs/${encodeURIComponent(pairId)}/alignment-matches`
      : "/library/alignment-matches",
  );
  return parseAlignmentMatchListResponse(response);
}

export async function createMediaAlignmentJob(
  input: CreateMediaAlignmentJobRequest,
): Promise<MediaAlignmentJob> {
  const request = createMediaAlignmentJobRequestSchema.parse(input);
  const response = await fetchAnalyzer(
    request.pairId
      ? `/library/pairs/${encodeURIComponent(request.pairId)}/alignment-jobs`
      : "/library/alignment-jobs",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  return parseAlignmentJobResponse(response);
}

export async function cancelMediaAlignmentJob(
  input: CancelMediaAlignmentJobRequest,
): Promise<MediaAlignmentJob> {
  const request = cancelMediaAlignmentJobRequestSchema.parse(input);
  const response = await fetchAnalyzer(
    `/library/alignment-jobs/${encodeURIComponent(request.jobId)}/cancel`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  return parseAlignmentJobResponse(response);
}

export async function createMediaIndexJob(
  input: CreateMediaIndexJobRequest,
): Promise<MediaIndexJob> {
  const request = createMediaIndexJobRequestSchema.parse(input);
  const response = await fetchAnalyzer(
    `/library/assets/${encodeURIComponent(request.assetId)}/index-jobs`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  return parseIndexJobResponse(response);
}

export async function cancelMediaIndexJob(
  input: CancelMediaIndexJobRequest,
): Promise<MediaIndexJob> {
  const request = cancelMediaIndexJobRequestSchema.parse(input);
  const response = await fetchAnalyzer(
    `/library/index-jobs/${encodeURIComponent(request.jobId)}/cancel`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  return parseIndexJobResponse(response);
}

export async function submitReviewUpdate(
  input: ReviewUpdateRequest,
): Promise<ProjectSession> {
  const request = reviewUpdateRequestSchema.parse(input);
  const response = await fetchAnalyzer("/review", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return parseSessionResponse(response);
}

export async function requestAnalyzerHealth(): Promise<unknown> {
  const response = await fetchAnalyzer("/health");
  if (!response.ok) {
    throw new AnalyzerBridgeError(
      "Analyzer health check failed",
      response.status,
    );
  }

  return await response.json().catch(() => null);
}
