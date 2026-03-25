import {
  analyzeProjectRequestSchema,
  projectSessionSchema,
  projectSessionSummarySchema,
  reviewUpdateRequestSchema,
  type AnalyzeProjectRequest,
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

async function parseSessionResponse(response: Response): Promise<ProjectSession> {
  const payload = (await response.json().catch(() => null)) as
    | AnalyzerSessionEnvelope
    | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  try {
    return projectSessionSchema.parse(payload?.session);
  } catch (error) {
    if (isZodErrorLike(error)) {
      const firstIssue = error.issues[0];
      const issuePathParts = firstIssue?.path ?? [];
      const issuePath =
        issuePathParts.length ? issuePathParts.join(".") : "session";
      throw new AnalyzerBridgeError(
        `Analyzer returned an invalid session payload at ${issuePath}: ${firstIssue?.message ?? "schema mismatch"}`,
        502,
      );
    }

    throw error;
  }
}

async function parseSessionSummaryListResponse(
  response: Response,
): Promise<ProjectSessionSummary[]> {
  const payload = (await response.json().catch(() => null)) as
    | AnalyzerSessionListEnvelope
    | null;

  if (!response.ok) {
    throw new AnalyzerBridgeError(
      payload?.message ?? "Analyzer request failed",
      response.status,
    );
  }

  try {
    return projectSessionSummarySchema.array().parse(payload?.sessions);
  } catch (error) {
    if (isZodErrorLike(error)) {
      const firstIssue = error.issues[0];
      const issuePathParts = firstIssue?.path ?? [];
      const issuePath =
        issuePathParts.length ? issuePathParts.join(".") : "sessions";
      throw new AnalyzerBridgeError(
        `Analyzer returned an invalid session summary payload at ${issuePath}: ${firstIssue?.message ?? "schema mismatch"}`,
        502,
      );
    }

    throw error;
  }
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

export async function requestSessionSummaries(): Promise<ProjectSessionSummary[]> {
  const response = await fetch(`${getAnalyzerUrl()}/sessions`);
  return parseSessionSummaryListResponse(response);
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
