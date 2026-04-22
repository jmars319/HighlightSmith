import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, it } from "node:test";
import { once } from "node:events";
import { buildProjectSummary } from "@highlightsmith/domain";
import { createMockProjectSession } from "@highlightsmith/shared-types/testing";
import { buildApp } from "./app";

describe("api smoke routes", () => {
  afterEach(() => {
    delete process.env.HIGHLIGHTSMITH_ANALYZER_URL;
    delete process.env.HIGHLIGHTSMITH_ANALYZER_TIMEOUT_MS;
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
        mode: "local-bridge",
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

  it("returns a timeout error when the analyzer stops responding", async () => {
    const analyzerServer = http.createServer((_request, _response) => {
      // Intentionally hold the socket open to exercise the bridge timeout.
    });

    analyzerServer.listen(0, "127.0.0.1");
    await once(analyzerServer, "listening");

    const address = analyzerServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind analyzer test server");
    }

    process.env.HIGHLIGHTSMITH_ANALYZER_URL = `http://127.0.0.1:${address.port}`;
    process.env.HIGHLIGHTSMITH_ANALYZER_TIMEOUT_MS = "50";

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      const payload = response.json() as {
        error: string;
        message: string;
      };

      assert.equal(response.statusCode, 502);
      assert.equal(payload.error, "session_list_failed");
      assert.match(payload.message, /timed out/i);
    } finally {
      analyzerServer.close();
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

  it("proxies media library assets and vod-edit pairs through the analyzer bridge", async () => {
    const asset = {
      id: "asset_clip_global_001",
      assetType: "CLIP",
      scope: "GLOBAL",
      sourceType: "LOCAL_FILE_PATH",
      sourceValue: "/tmp/global-clip.mp4",
      title: "Global opener reference",
      note: "Reusable clip example.",
      status: "LOCAL_FILE_AVAILABLE",
      statusDetail: "Local clip summary is ready for heuristic profile matching.",
      featureSummary: {
        methodVersion: "LOCAL_FILE_HEURISTIC_V2",
        generatedAt: "2026-04-20T12:00:00.000Z",
        durationSeconds: 42,
        transcriptChunkCount: 4,
        transcriptDensityPerMinute: 5.7,
        candidateSeedCount: 3,
        candidateDensityPerMinute: 4.3,
        transcriptAnchorTerms: ["opener", "panic"],
        transcriptAnchorPhrases: ["opener panic"],
        speechDensityMean: 0.5,
        speechDensityPeak: 0.75,
        energyMean: 0.48,
        energyPeak: 0.72,
        pacingMean: 0.41,
        overlapActivityMean: 0.22,
        highActivityShare: 0.25,
        topReasonCodes: ["REACTION_PHRASE"],
        coverageBand: "PARTIAL",
        coverageFlags: ["SEEDED_TRANSCRIPT"],
      },
      indexArtifactSummary: {
        latestAudioFingerprintArtifactId: "artifact_audio_001",
        audioFingerprintBucketCount: 2,
        audioFingerprintMethod: "BYTE_SAMPLED_AUDIO_PROXY_V1",
        audioFingerprintUpdatedAt: "2026-04-20T12:10:00.000Z",
        bucketDurationSeconds: 30,
        confidenceScore: 0.18,
      },
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    };
    const pair = {
      id: "pair_story_arc_001",
      vodAssetId: "asset_vod_001",
      editAssetId: "asset_edit_001",
      title: "Story arc pair",
      note: "Coarse edit decision record.",
      status: "READY",
      statusDetail:
        "Paired source and edit registered. This is a coarse runtime-based editorial summary only; timeline-level keep/remove alignment is not implemented yet.",
      sourceDurationSeconds: 14400,
      editDurationSeconds: 3420,
      keptDurationSeconds: 3420,
      removedDurationSeconds: 10980,
      keepRatio: 0.2375,
      compressionRatio: 4.2105,
      createdAt: "2026-04-20T12:05:00.000Z",
      updatedAt: "2026-04-20T12:05:00.000Z",
    };
    const indexJob = {
      id: "index_job_001",
      assetId: asset.id,
      status: "SUCCEEDED",
      progress: 1,
      statusDetail: "Media index ready.",
      result: {
        methodVersion: "MEDIA_INDEX_V1",
        generatedAt: "2026-04-20T12:10:00.000Z",
        sourcePath: "/tmp/global-clip.mp4",
        fileName: "global-clip.mp4",
        fileSizeBytes: 1024,
        kind: "VIDEO",
        format: "mov,mp4,m4a,3gp,3g2,mj2",
        durationSeconds: 42,
        frameRate: 60,
        width: 1920,
        height: 1080,
        videoCodec: "h264",
        audioCodec: "aac",
        hasVideo: true,
        hasAudio: true,
        streamCount: 2,
        notes: ["Metadata probed with local ffprobe."],
      },
      createdAt: "2026-04-20T12:09:00.000Z",
      updatedAt: "2026-04-20T12:10:00.000Z",
      startedAt: "2026-04-20T12:09:00.000Z",
      finishedAt: "2026-04-20T12:10:00.000Z",
    };
    const artifact = {
      id: "artifact_audio_001",
      assetId: asset.id,
      jobId: indexJob.id,
      kind: "AUDIO_FINGERPRINT",
      method: "BYTE_SAMPLED_AUDIO_PROXY_V1",
      bucketDurationSeconds: 30,
      durationSeconds: 42,
      bucketCount: 2,
      confidenceScore: 0.18,
      payloadByteSize: 250,
      energyMean: 0.42,
      energyPeak: 0.5,
      onsetMean: 0.15,
      silenceShare: 0.31,
      buckets: [
        {
          index: 0,
          startSeconds: 0,
          endSeconds: 30,
          energyScore: 0.5,
          onsetScore: 0.15,
          spectralFluxScore: 0.2,
          silenceScore: 0.15,
          fingerprint: "0123456789abcdef0000",
        },
        {
          index: 1,
          startSeconds: 30,
          endSeconds: 42,
          energyScore: 0.34,
          onsetScore: 0.15,
          spectralFluxScore: 0.19,
          silenceScore: 0.47,
          fingerprint: "fedcba98765432100000",
        },
      ],
      note:
        "Bounded byte-sampled audio proxy for coarse future matching.",
      createdAt: "2026-04-20T12:10:00.000Z",
      updatedAt: "2026-04-20T12:10:00.000Z",
    };
    const alignmentJob = {
      id: "align_job_001",
      pairId: pair.id,
      sourceAssetId: pair.vodAssetId,
      queryAssetId: pair.editAssetId,
      status: "SUCCEEDED",
      progress: 1,
      statusDetail: "Alignment complete with 1 candidate match.",
      method: "AUDIO_PROXY_BUCKET_CORRELATION_V1",
      matchCount: 1,
      createdAt: "2026-04-20T12:12:00.000Z",
      updatedAt: "2026-04-20T12:13:00.000Z",
      startedAt: "2026-04-20T12:12:00.000Z",
      finishedAt: "2026-04-20T12:13:00.000Z",
    };
    const alignmentMatch = {
      id: "align_match_001",
      jobId: alignmentJob.id,
      pairId: pair.id,
      sourceAssetId: pair.vodAssetId,
      queryAssetId: pair.editAssetId,
      kind: "EDIT_TO_VOD_KEEP",
      method: "AUDIO_PROXY_BUCKET_CORRELATION_V1",
      sourceRange: {
        startSeconds: 300,
        endSeconds: 420,
      },
      queryRange: {
        startSeconds: 0,
        endSeconds: 120,
      },
      score: 0.72,
      confidenceScore: 0.34,
      matchedBucketCount: 4,
      totalQueryBucketCount: 114,
      bucketMatches: [
        {
          queryBucketIndex: 0,
          sourceBucketIndex: 10,
          score: 0.72,
        },
      ],
      note: "Candidate alignment from byte-sampled audio proxy buckets.",
      createdAt: "2026-04-20T12:13:00.000Z",
      updatedAt: "2026-04-20T12:13:00.000Z",
    };

    const analyzerServer = http.createServer((request, response) => {
      if (request.method === "GET" && request.url === "/library/assets") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "listed",
            assets: [asset],
          }),
        );
        return;
      }

      if (request.method === "POST" && request.url === "/library/assets") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "created",
            asset,
          }),
        );
        return;
      }

      if (request.method === "GET" && request.url === "/library/pairs") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "listed",
            pairs: [pair],
          }),
        );
        return;
      }

      if (request.method === "POST" && request.url === "/library/pairs") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "created",
            pair,
          }),
        );
        return;
      }

      if (request.method === "GET" && request.url === "/library/index-jobs") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "listed",
            jobs: [indexJob],
          }),
        );
        return;
      }

      if (request.method === "GET" && request.url === "/library/index-artifacts") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "listed",
            artifacts: [artifact],
          }),
        );
        return;
      }

      if (
        request.method === "GET" &&
        request.url === `/library/assets/${asset.id}/index-artifacts`
      ) {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "listed",
            artifacts: [artifact],
          }),
        );
        return;
      }

      if (request.method === "GET" && request.url === "/library/alignment-jobs") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "listed",
            jobs: [alignmentJob],
          }),
        );
        return;
      }

      if (request.method === "GET" && request.url === "/library/alignment-matches") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "listed",
            matches: [alignmentMatch],
          }),
        );
        return;
      }

      if (
        request.method === "GET" &&
        request.url === `/library/pairs/${pair.id}/alignment-matches`
      ) {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "listed",
            matches: [alignmentMatch],
          }),
        );
        return;
      }

      if (request.method === "POST" && request.url === "/library/alignment-jobs") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "created",
            job: alignmentJob,
          }),
        );
        return;
      }

      if (
        request.method === "POST" &&
        request.url === `/library/pairs/${pair.id}/alignment-jobs`
      ) {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "created",
            job: alignmentJob,
          }),
        );
        return;
      }

      if (
        request.method === "POST" &&
        request.url === `/library/alignment-jobs/${alignmentJob.id}/cancel`
      ) {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "cancelled",
            job: {
              ...alignmentJob,
              status: "CANCELLED",
              cancelledAt: "2026-04-20T12:14:00.000Z",
            },
          }),
        );
        return;
      }

      if (
        request.method === "POST" &&
        request.url === `/library/assets/${asset.id}/index-jobs`
      ) {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "created",
            job: indexJob,
          }),
        );
        return;
      }

      if (
        request.method === "POST" &&
        request.url === `/library/index-jobs/${indexJob.id}/cancel`
      ) {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            status: "cancelled",
            job: { ...indexJob, status: "CANCELLED", cancelledAt: "2026-04-20T12:11:00.000Z" },
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
      const listAssetsResponse = await app.inject({
        method: "GET",
        url: "/api/library/assets",
      });
      const createAssetResponse = await app.inject({
        method: "POST",
        url: "/api/library/assets",
        payload: {
          assetType: "CLIP",
          scope: "GLOBAL",
          sourceType: "LOCAL_FILE_PATH",
          sourceValue: "/tmp/global-clip.mp4",
          title: "Global opener reference",
        },
      });
      const listPairsResponse = await app.inject({
        method: "GET",
        url: "/api/library/pairs",
      });
      const createPairResponse = await app.inject({
        method: "POST",
        url: "/api/library/pairs",
        payload: {
          vodAssetId: "asset_vod_001",
          editAssetId: "asset_edit_001",
          title: "Story arc pair",
        },
      });
      const listIndexJobsResponse = await app.inject({
        method: "GET",
        url: "/api/library/index-jobs",
      });
      const listIndexArtifactsResponse = await app.inject({
        method: "GET",
        url: "/api/library/index-artifacts",
      });
      const listAssetIndexArtifactsResponse = await app.inject({
        method: "GET",
        url: `/api/library/assets/${asset.id}/index-artifacts`,
      });
      const listAlignmentJobsResponse = await app.inject({
        method: "GET",
        url: "/api/library/alignment-jobs",
      });
      const listAlignmentMatchesResponse = await app.inject({
        method: "GET",
        url: "/api/library/alignment-matches",
      });
      const listPairAlignmentMatchesResponse = await app.inject({
        method: "GET",
        url: `/api/library/pairs/${pair.id}/alignment-matches`,
      });
      const createAlignmentJobResponse = await app.inject({
        method: "POST",
        url: "/api/library/alignment-jobs",
        payload: {
          sourceAssetId: pair.vodAssetId,
          queryAssetId: pair.editAssetId,
        },
      });
      const createPairAlignmentJobResponse = await app.inject({
        method: "POST",
        url: `/api/library/pairs/${pair.id}/alignment-jobs`,
      });
      const cancelAlignmentJobResponse = await app.inject({
        method: "POST",
        url: `/api/library/alignment-jobs/${alignmentJob.id}/cancel`,
      });
      const createIndexJobResponse = await app.inject({
        method: "POST",
        url: `/api/library/assets/${asset.id}/index-jobs`,
      });
      const cancelIndexJobResponse = await app.inject({
        method: "POST",
        url: `/api/library/index-jobs/${indexJob.id}/cancel`,
      });

      assert.equal(listAssetsResponse.statusCode, 200);
      assert.equal(createAssetResponse.statusCode, 200);
      assert.equal(listPairsResponse.statusCode, 200);
      assert.equal(createPairResponse.statusCode, 200);
      assert.equal(listIndexJobsResponse.statusCode, 200);
      assert.equal(listIndexArtifactsResponse.statusCode, 200);
      assert.equal(listAssetIndexArtifactsResponse.statusCode, 200);
      assert.equal(listAlignmentJobsResponse.statusCode, 200);
      assert.equal(listAlignmentMatchesResponse.statusCode, 200);
      assert.equal(listPairAlignmentMatchesResponse.statusCode, 200);
      assert.equal(createAlignmentJobResponse.statusCode, 200);
      assert.equal(createPairAlignmentJobResponse.statusCode, 200);
      assert.equal(cancelAlignmentJobResponse.statusCode, 200);
      assert.equal(createIndexJobResponse.statusCode, 200);
      assert.equal(cancelIndexJobResponse.statusCode, 200);

      const listedAssets = listAssetsResponse.json() as Array<{ id: string }>;
      const createdAsset = createAssetResponse.json() as { id: string };
      const listedPairs = listPairsResponse.json() as Array<{ id: string }>;
      const createdPair = createPairResponse.json() as { id: string };
      const listedJobs = listIndexJobsResponse.json() as Array<{ id: string }>;
      const listedArtifacts = listIndexArtifactsResponse.json() as Array<{ id: string }>;
      const listedAssetArtifacts = listAssetIndexArtifactsResponse.json() as Array<{ id: string }>;
      const listedAlignmentJobs = listAlignmentJobsResponse.json() as Array<{ id: string }>;
      const listedAlignmentMatches = listAlignmentMatchesResponse.json() as Array<{ id: string }>;
      const listedPairAlignmentMatches = listPairAlignmentMatchesResponse.json() as Array<{ id: string }>;
      const createdAlignmentJob = createAlignmentJobResponse.json() as { id: string };
      const createdPairAlignmentJob = createPairAlignmentJobResponse.json() as { id: string };
      const cancelledAlignmentJob = cancelAlignmentJobResponse.json() as {
        id: string;
        status: string;
      };
      const createdJob = createIndexJobResponse.json() as { id: string };
      const cancelledJob = cancelIndexJobResponse.json() as {
        id: string;
        status: string;
      };

      assert.equal(listedAssets[0]?.id, asset.id);
      assert.equal(createdAsset.id, asset.id);
      assert.equal(listedPairs[0]?.id, pair.id);
      assert.equal(createdPair.id, pair.id);
      assert.equal(listedJobs[0]?.id, indexJob.id);
      assert.equal(listedArtifacts[0]?.id, artifact.id);
      assert.equal(listedAssetArtifacts[0]?.id, artifact.id);
      assert.equal(listedAlignmentJobs[0]?.id, alignmentJob.id);
      assert.equal(listedAlignmentMatches[0]?.id, alignmentMatch.id);
      assert.equal(listedPairAlignmentMatches[0]?.id, alignmentMatch.id);
      assert.equal(createdAlignmentJob.id, alignmentJob.id);
      assert.equal(createdPairAlignmentJob.id, alignmentJob.id);
      assert.equal(cancelledAlignmentJob.status, "CANCELLED");
      assert.equal(createdJob.id, indexJob.id);
      assert.equal(cancelledJob.status, "CANCELLED");
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
