import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, it } from "node:test";
import { once } from "node:events";
import { buildProjectSummary } from "@highlightsmith/domain";
import { createMockProjectSession } from "@highlightsmith/shared-types";
import { buildApp } from "./app";

describe("api smoke routes", () => {
  afterEach(() => {
    delete process.env.HIGHLIGHTSMITH_ANALYZER_URL;
  });

  it("serves the health endpoint", async () => {
    const app = await buildApp();

    try {
      const healthResponse = await app.inject({
        method: "GET",
        url: "/health",
      });

      const healthPayload = healthResponse.json() as {
        service: string;
        status: string;
        mode: string;
      };

      assert.equal(healthResponse.statusCode, 200);
      assert.deepEqual(healthPayload, {
        service: "api",
        status: "ok",
        mode: "placeholder-bridge",
      });
    } finally {
      await app.close();
    }
  });

  it("proxies persisted session summaries through the analyzer bridge", async () => {
    const analyzerSession = createMockProjectSession();
    analyzerSession.id = "session_media_backlog";
    analyzerSession.title = "Backlog VOD Review";
    analyzerSession.mediaSource.path = "/tmp/backlog-vod.mkv";
    analyzerSession.mediaSource.fileName = "backlog-vod.mkv";
    analyzerSession.reviewDecisions = [
      {
        id: "review_session_media_backlog_candidate_001",
        projectSessionId: analyzerSession.id,
        candidateId: analyzerSession.candidates[0].id,
        action: "ACCEPT",
        createdAt: "2026-03-25T15:00:00.000Z",
      },
      {
        id: "review_session_media_backlog_candidate_002",
        projectSessionId: analyzerSession.id,
        candidateId: analyzerSession.candidates[1].id,
        action: "REJECT",
        createdAt: "2026-03-25T15:02:00.000Z",
      },
    ];

    const analyzerSummary = buildProjectSummary(analyzerSession);

    const analyzerServer = http.createServer((request, response) => {
      if (request.method !== "GET" || request.url !== "/sessions") {
        response.statusCode = 404;
        response.end();
        return;
      }

      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          status: "listed",
          sessions: [analyzerSummary],
        }),
      );
    });

    analyzerServer.listen(0, "127.0.0.1");
    await once(analyzerServer, "listening");

    const address = analyzerServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind analyzer test server");
    }

    process.env.HIGHLIGHTSMITH_ANALYZER_URL = `http://127.0.0.1:${address.port}`;

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      const payload = response.json() as Array<{
        sessionId: string;
        sessionTitle: string;
        sourcePath: string;
        sourceName: string;
        candidateCount: number;
        acceptedCount: number;
        rejectedCount: number;
        pendingCount: number;
      }>;

      assert.equal(response.statusCode, 200);
      assert.equal(payload.length, 1);
      assert.deepEqual(payload[0], analyzerSummary);
    } finally {
      analyzerServer.close();
      await app.close();
    }
  });

  it("reports an unreachable analyzer bridge cleanly", async () => {
    process.env.HIGHLIGHTSMITH_ANALYZER_URL = "http://127.0.0.1:1";
    const app = await buildApp();

    try {
      const bridgeResponse = await app.inject({
        method: "GET",
        url: "/api/bridge/analyzer",
      });

      assert.equal(bridgeResponse.statusCode, 200);
      assert.deepEqual(bridgeResponse.json(), {
        analyzer: "unreachable",
        payload: null,
      });
    } finally {
      await app.close();
    }
  });

  it("proxies profile and example clip routes through the analyzer bridge", async () => {
    const profile = {
      id: "profile_dry_humor",
      name: "Dry humor",
      label: "Dry humor",
      description: "Deadpan reactions and low-key payoffs.",
      createdAt: "2026-04-11T00:00:00.000Z",
      updatedAt: "2026-04-11T00:00:00.000Z",
      state: "ACTIVE",
      source: "USER",
      mode: "EXAMPLE_DRIVEN",
      signalWeights: {},
      exampleClips: [],
    };
    const example = {
      id: "example_001",
      profileId: profile.id,
      sourceType: "TWITCH_CLIP_URL",
      sourceValue: "https://clips.twitch.tv/example",
      title: "Dry payoff example",
      note: "Hold for deadpan timing.",
      status: "REFERENCE_ONLY",
      statusDetail:
        "Remote clip retrieval is not enabled yet. HighlightSmith is storing this reference for future matching work.",
      createdAt: "2026-04-11T00:00:00.000Z",
      updatedAt: "2026-04-11T00:00:00.000Z",
    };

    const analyzerServer = http.createServer((request, response) => {
      if (request.method === "GET" && request.url === "/profiles") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "listed",
            profiles: [{ ...profile, exampleClips: [example] }],
          }),
        );
        return;
      }

      if (
        request.method === "GET" &&
        request.url === `/profiles/${profile.id}/examples`
      ) {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "listed",
            examples: [example],
          }),
        );
        return;
      }

      if (request.method === "POST" && request.url === "/profiles") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "created",
            profile,
          }),
        );
        return;
      }

      if (
        request.method === "POST" &&
        request.url === `/profiles/${profile.id}/examples`
      ) {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "created",
            example,
          }),
        );
        return;
      }

      response.statusCode = 404;
      response.end();
    });

    analyzerServer.listen(0, "127.0.0.1");
    await once(analyzerServer, "listening");

    const address = analyzerServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind analyzer test server");
    }

    process.env.HIGHLIGHTSMITH_ANALYZER_URL = `http://127.0.0.1:${address.port}`;

    const app = await buildApp();
    try {
      const listProfilesResponse = await app.inject({
        method: "GET",
        url: "/api/profiles",
      });
      const createProfileResponse = await app.inject({
        method: "POST",
        url: "/api/profiles",
        payload: {
          name: "Dry humor",
          description: "Deadpan reactions and low-key payoffs.",
        },
      });
      const listExamplesResponse = await app.inject({
        method: "GET",
        url: `/api/profiles/${profile.id}/examples`,
      });
      const createExampleResponse = await app.inject({
        method: "POST",
        url: `/api/profiles/${profile.id}/examples`,
        payload: {
          sourceType: "TWITCH_CLIP_URL",
          sourceValue: "https://clips.twitch.tv/example",
          title: "Dry payoff example",
          note: "Hold for deadpan timing.",
        },
      });

      assert.equal(listProfilesResponse.statusCode, 200);
      assert.equal(createProfileResponse.statusCode, 200);
      assert.equal(listExamplesResponse.statusCode, 200);
      assert.equal(createExampleResponse.statusCode, 200);

      const listedProfiles = listProfilesResponse.json() as Array<{
        id: string;
        exampleClips: Array<{ id: string }>;
      }>;
      const createdProfile = createProfileResponse.json() as { id: string };
      const listedExamples = listExamplesResponse.json() as Array<{
        id: string;
        profileId: string;
      }>;
      const createdExample = createExampleResponse.json() as {
        id: string;
        profileId: string;
      };

      assert.equal(listedProfiles[0]?.id, profile.id);
      assert.equal(listedProfiles[0]?.exampleClips.length, 1);
      assert.equal(createdProfile.id, profile.id);
      assert.equal(listedExamples[0]?.id, example.id);
      assert.equal(createdExample.profileId, profile.id);
    } finally {
      analyzerServer.close();
      await app.close();
    }
  });

  it("proxies a real analyze request through to the analyzer", async () => {
    const analyzerSession = createMockProjectSession();
    analyzerSession.id = "session_media_backlog";
    analyzerSession.title = "Backlog VOD Review";
    analyzerSession.mediaSource.path = "/tmp/backlog-vod.mkv";
    analyzerSession.mediaSource.fileName = "backlog-vod.mkv";

    const analyzerServer = http.createServer((request, response) => {
      if (request.method !== "POST" || request.url !== "/analyze") {
        response.statusCode = 404;
        response.end();
        return;
      }

      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          status: "completed",
          session: analyzerSession,
        }),
      );
    });

    analyzerServer.listen(0, "127.0.0.1");
    await once(analyzerServer, "listening");

    const address = analyzerServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind analyzer test server");
    }

    process.env.HIGHLIGHTSMITH_ANALYZER_URL = `http://127.0.0.1:${address.port}`;

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects/analyze",
        payload: {
          sourcePath: "/tmp/backlog-vod.mkv",
          profileId: "generic",
          sessionTitle: "Backlog VOD Review",
        },
      });

      const payload = response.json() as {
        id: string;
        title: string;
        mediaSource: {
          path: string;
        };
      };

      assert.equal(response.statusCode, 200);
      assert.equal(payload.id, "session_media_backlog");
      assert.equal(payload.title, "Backlog VOD Review");
      assert.equal(payload.mediaSource.path, "/tmp/backlog-vod.mkv");
    } finally {
      analyzerServer.close();
      await app.close();
    }
  });

  it("loads a persisted session through the analyzer bridge", async () => {
    const analyzerSession = createMockProjectSession();
    analyzerSession.id = "session_media_restore";
    analyzerSession.title = "Persisted Review Session";
    analyzerSession.reviewDecisions = [
      {
        id: "review_session_media_restore_candidate_001",
        projectSessionId: analyzerSession.id,
        candidateId: analyzerSession.candidates[0].id,
        action: "ACCEPT",
        label: "Keep opener payoff",
        adjustedSegment: {
          startSeconds: 320,
          endSeconds: 346,
        },
        createdAt: "2026-03-25T14:10:00.000Z",
      },
    ];

    const analyzerServer = http.createServer((request, response) => {
      if (
        request.method !== "GET" ||
        request.url !== `/session/${analyzerSession.id}`
      ) {
        response.statusCode = 404;
        response.end();
        return;
      }

      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          status: "loaded",
          session: analyzerSession,
        }),
      );
    });

    analyzerServer.listen(0, "127.0.0.1");
    await once(analyzerServer, "listening");

    const address = analyzerServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind analyzer test server");
    }

    process.env.HIGHLIGHTSMITH_ANALYZER_URL = `http://127.0.0.1:${address.port}`;

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${analyzerSession.id}`,
      });

      const payload = response.json() as {
        id: string;
        reviewDecisions: Array<{
          action: string;
          label?: string;
        }>;
      };

      assert.equal(response.statusCode, 200);
      assert.equal(payload.id, analyzerSession.id);
      assert.equal(payload.reviewDecisions[0]?.action, "ACCEPT");
      assert.equal(payload.reviewDecisions[0]?.label, "Keep opener payoff");
    } finally {
      analyzerServer.close();
      await app.close();
    }
  });

  it("proxies review updates and returns the updated session", async () => {
    const analyzerSession = createMockProjectSession();
    analyzerSession.id = "session_media_review";
    analyzerSession.title = "Review Update Session";
    analyzerSession.reviewDecisions = [
      {
        id: "review_session_media_review_candidate_001",
        projectSessionId: analyzerSession.id,
        candidateId: analyzerSession.candidates[0].id,
        action: "RETIME",
        label: "Trim lead-in",
        adjustedSegment: {
          startSeconds: 318,
          endSeconds: 344,
        },
        createdAt: "2026-03-25T14:12:00.000Z",
      },
    ];
    analyzerSession.candidates[0].editableLabel = "Trim lead-in";
    analyzerSession.candidates[0].suggestedSegment.startSeconds = 318;
    analyzerSession.candidates[0].suggestedSegment.endSeconds = 344;

    let capturedBody = "";
    const analyzerServer = http.createServer((request, response) => {
      if (request.method !== "POST" || request.url !== "/review") {
        response.statusCode = 404;
        response.end();
        return;
      }

      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        capturedBody += chunk;
      });
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "updated",
            session: analyzerSession,
          }),
        );
      });
    });

    analyzerServer.listen(0, "127.0.0.1");
    await once(analyzerServer, "listening");

    const address = analyzerServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind analyzer test server");
    }

    process.env.HIGHLIGHTSMITH_ANALYZER_URL = `http://127.0.0.1:${address.port}`;

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects/review",
        payload: {
          sessionId: analyzerSession.id,
          candidateId: analyzerSession.candidates[0].id,
          action: "RETIME",
          label: "Trim lead-in",
          adjustedSegment: {
            startSeconds: 318,
            endSeconds: 344,
          },
          timestamp: "2026-03-25T14:12:00.000Z",
        },
      });

      const payload = response.json() as {
        id: string;
        candidates: Array<{
          editableLabel: string;
          suggestedSegment: {
            startSeconds: number;
            endSeconds: number;
          };
        }>;
      };

      assert.equal(response.statusCode, 200);
      assert.equal(payload.id, analyzerSession.id);
      assert.equal(payload.candidates[0]?.editableLabel, "Trim lead-in");
      assert.equal(payload.candidates[0]?.suggestedSegment.startSeconds, 318);

      const forwardedRequest = JSON.parse(capturedBody) as {
        sessionId: string;
        candidateId: string;
        action: string;
      };
      assert.equal(forwardedRequest.sessionId, analyzerSession.id);
      assert.equal(
        forwardedRequest.candidateId,
        analyzerSession.candidates[0].id,
      );
      assert.equal(forwardedRequest.action, "RETIME");
    } finally {
      analyzerServer.close();
      await app.close();
    }
  });
});
