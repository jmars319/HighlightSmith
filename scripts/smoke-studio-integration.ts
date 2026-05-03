import assert from "node:assert/strict";
import {
  fetchLatestStudioRecording,
  studioEventSocketUrl,
  studioRecordingFromHistoryEntry,
  studioRecordingFromMessage,
  studioRequestHeaders,
  type StudioDiscovery,
} from "../apps/desktopapp/src/lib/studioIntegration.ts";

const discovery: StudioDiscovery = {
  apiUrl: "http://127.0.0.1:51287",
  wsUrl: "ws://127.0.0.1:51287/events",
  token: "studio-token",
  discovered: true,
  source: "smoke",
  detail: "smoke test",
};

const headers = new Headers(studioRequestHeaders(discovery));
assert.equal(headers.get("x-vaexcore-client-id"), "vaexcore-pulse");
assert.equal(headers.get("x-vaexcore-client-name"), "vaexcore pulse");
assert.equal(headers.get("x-vaexcore-token"), "studio-token");

const socketUrl = new URL(studioEventSocketUrl(discovery));
assert.equal(socketUrl.searchParams.get("client_id"), "vaexcore-pulse-events");
assert.equal(socketUrl.searchParams.get("token"), "studio-token");

const eventRecording = studioRecordingFromMessage(
  JSON.stringify({
    type: "recording.stopped",
    timestamp: "2026-05-02T12:05:00Z",
    payload: {
      session_id: "rec_event",
      output_path: "/tmp/event-session.mkv",
      profile_id: "profile_1080p",
    },
  }),
);
assert.equal(eventRecording?.sessionId, "rec_event");
assert.equal(eventRecording?.outputPath, "/tmp/event-session.mkv");

const historyRecording = studioRecordingFromHistoryEntry({
  session_id: "rec_history",
  output_path: "/tmp/history-session.mkv",
  profile_id: "profile_1080p",
  stopped_at: "2026-05-02T12:10:00Z",
});
assert.equal(historyRecording?.sessionId, "rec_history");

const mockFetch: typeof fetch = async (input, init) => {
  assert.equal(String(input), "http://127.0.0.1:51287/recordings/recent");
  const requestHeaders = new Headers(init?.headers);
  assert.equal(requestHeaders.get("x-vaexcore-client-id"), "vaexcore-pulse");
  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        recordings: [
          {
            session_id: "rec_latest",
            output_path: "/tmp/latest-session.mkv",
            profile_id: "profile_1080p",
            stopped_at: "2026-05-02T12:15:00Z",
          },
        ],
      },
      error: null,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const latestRecording = await fetchLatestStudioRecording(discovery, mockFetch);
  assert.equal(latestRecording?.sessionId, "rec_latest");

  console.log("pulse studio integration smoke passed");
}
