import {
  addExampleClipRequestSchema,
  analyzeProjectRequestSchema,
  clipProfileSchema,
  createClipProfileRequestSchema,
  exampleClipSchema,
  projectSessionSchema,
  projectSessionSummarySchema,
  reviewUpdateRequestSchema,
  type AddExampleClipRequest,
  type AnalyzeProjectRequest,
  type ClipProfile,
  type CreateClipProfileRequest,
  type ExampleClip,
  type ProjectSession,
  type ProjectSessionSummary,
  type ReviewUpdateRequest,
} from "@highlightsmith/shared-types";

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
  return process.env.HIGHLIGHTSMITH_ANALYZER_URL ?? "http://127.0.0.1:9010";
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

export async function requestAnalyzerSession(
  input: AnalyzeProjectRequest,
): Promise<ProjectSession> {
  const request = analyzeProjectRequestSchema.parse(input);
  const response = await fetch(`${getAnalyzerUrl()}/analyze`, {
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
  const response = await fetch(
    `${getAnalyzerUrl()}/session/${encodeURIComponent(sessionId)}`,
  );
  return parseSessionResponse(response);
}

export async function requestSessionSummaries(): Promise<
  ProjectSessionSummary[]
> {
  const response = await fetch(`${getAnalyzerUrl()}/sessions`);
  return parseSessionSummaryListResponse(response);
}

export async function requestProfiles(): Promise<ClipProfile[]> {
  const response = await fetch(`${getAnalyzerUrl()}/profiles`);
  return parseProfileListResponse(response);
}

export async function createProfile(
  input: CreateClipProfileRequest,
): Promise<ClipProfile> {
  const request = createClipProfileRequestSchema.parse(input);
  const response = await fetch(`${getAnalyzerUrl()}/profiles`, {
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
  const response = await fetch(
    `${getAnalyzerUrl()}/profiles/${encodeURIComponent(profileId)}/examples`,
  );
  return parseExampleListResponse(response);
}

export async function addProfileExample(
  profileId: string,
  input: AddExampleClipRequest,
): Promise<ExampleClip> {
  const request = addExampleClipRequestSchema.parse(input);
  const response = await fetch(
    `${getAnalyzerUrl()}/profiles/${encodeURIComponent(profileId)}/examples`,
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

export async function submitReviewUpdate(
  input: ReviewUpdateRequest,
): Promise<ProjectSession> {
  const request = reviewUpdateRequestSchema.parse(input);
  const response = await fetch(`${getAnalyzerUrl()}/review`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return parseSessionResponse(response);
}
