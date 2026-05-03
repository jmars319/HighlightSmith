import { isSupportedInput } from "@vaexcore/pulse-media";

export type StudioConnectionState = "checking" | "connected" | "unavailable";

export type StudioDiscovery = {
  apiUrl: string;
  wsUrl: string;
  token: string | null;
  discovered: boolean;
  source: string;
  detail: string;
};

export type StudioRecordingCandidate = {
  sessionId: string;
  outputPath: string;
  profileId: string | null;
  stoppedAt: string;
};

export type StudioIntakeState = {
  connection: StudioConnectionState;
  detail: string;
  apiUrl: string | null;
  latestRecording: StudioRecordingCandidate | null;
};

type StudioRecentRecordingsSnapshot = {
  recordings?: unknown;
};

type StudioApiEnvelope = {
  ok?: unknown;
  data?: unknown;
  error?: unknown;
};

export function studioRequestHeaders(discovery: StudioDiscovery): HeadersInit {
  const headers: Record<string, string> = {
    "x-vaexcore-client-id": "vaexcore-pulse",
    "x-vaexcore-client-name": "vaexcore pulse",
  };

  if (discovery.token) {
    headers["x-vaexcore-token"] = discovery.token;
  }

  return headers;
}

export function studioEventSocketUrl(discovery: StudioDiscovery): string {
  const url = new URL(discovery.wsUrl);
  url.searchParams.set("client_id", "vaexcore-pulse-events");
  url.searchParams.set("client_name", "vaexcore pulse events");
  url.searchParams.set("limit", "25");
  if (discovery.token) {
    url.searchParams.set("token", discovery.token);
  }
  return url.toString();
}

export function studioRecordingFromMessage(
  rawMessage: unknown,
): StudioRecordingCandidate | null {
  if (typeof rawMessage !== "string") {
    return null;
  }

  let event: unknown;
  try {
    event = JSON.parse(rawMessage);
  } catch {
    return null;
  }

  if (!event || typeof event !== "object") {
    return null;
  }

  const typedEvent = event as {
    type?: unknown;
    timestamp?: unknown;
    payload?: unknown;
  };
  if (typedEvent.type !== "recording.stopped") {
    return null;
  }

  const payload =
    typedEvent.payload && typeof typedEvent.payload === "object"
      ? (typedEvent.payload as Record<string, unknown>)
      : {};
  const outputPath =
    typeof payload.output_path === "string" ? payload.output_path.trim() : "";

  if (!outputPath || !isSupportedInput(outputPath)) {
    return null;
  }

  return {
    sessionId:
      typeof payload.session_id === "string" ? payload.session_id : "unknown",
    outputPath,
    profileId:
      typeof payload.profile_id === "string" ? payload.profile_id : null,
    stoppedAt:
      typeof typedEvent.timestamp === "string"
        ? typedEvent.timestamp
        : new Date().toISOString(),
  };
}

export function studioRecordingFromHistoryEntry(
  entry: unknown,
): StudioRecordingCandidate | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const outputPath =
    typeof record.output_path === "string" ? record.output_path.trim() : "";
  if (!outputPath || !isSupportedInput(outputPath)) {
    return null;
  }

  return {
    sessionId:
      typeof record.session_id === "string" ? record.session_id : "unknown",
    outputPath,
    profileId: typeof record.profile_id === "string" ? record.profile_id : null,
    stoppedAt:
      typeof record.stopped_at === "string"
        ? record.stopped_at
        : new Date().toISOString(),
  };
}

export async function fetchLatestStudioRecording(
  discovery: StudioDiscovery,
  fetchImpl: typeof fetch = fetch,
): Promise<StudioRecordingCandidate | null> {
  const response = await fetchImpl(`${discovery.apiUrl}/recordings/recent`, {
    headers: studioRequestHeaders(discovery),
  });
  const body = (await response.json()) as StudioApiEnvelope;

  if (!response.ok || body.ok !== true) {
    return null;
  }

  const snapshot =
    body.data && typeof body.data === "object"
      ? (body.data as StudioRecentRecordingsSnapshot)
      : {};
  const recordings = Array.isArray(snapshot.recordings)
    ? snapshot.recordings
    : [];

  for (const recording of recordings) {
    const candidate = studioRecordingFromHistoryEntry(recording);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}
