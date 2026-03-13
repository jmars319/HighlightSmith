import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { buildApp } from "./app";

describe("api smoke routes", () => {
  afterEach(() => {
    delete process.env.HIGHLIGHTSMITH_ANALYZER_URL;
  });

  it("serves health and project summary endpoints", async () => {
    const app = await buildApp();

    try {
      const healthResponse = await app.inject({
        method: "GET",
        url: "/health",
      });
      const projectsResponse = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      const healthPayload = healthResponse.json() as {
        service: string;
        status: string;
        mode: string;
      };
      const projectsPayload = projectsResponse.json() as Array<{
        id: string;
        title: string;
        profileId: string;
        candidateCount: number;
        acceptedCount: number;
        updatedAt: string;
        mediaPath: string;
      }>;

      assert.equal(healthResponse.statusCode, 200);
      assert.deepEqual(healthPayload, {
        service: "api",
        status: "ok",
        mode: "placeholder-bridge",
      });

      assert.equal(projectsResponse.statusCode, 200);
      assert.equal(projectsPayload.length, 3);
      assert.deepEqual(projectsPayload[0], {
        id: "session_demo_local",
        title: "Raid Night Demo Review",
        profileId: "generic",
        candidateCount: 4,
        acceptedCount: 0,
        updatedAt: "2026-03-13T09:05:00.000Z",
        mediaPath: "/Users/jason_marshall/VODs/raid-night-2026-03-07.mkv",
      });
    } finally {
      await app.close();
    }
  });

  it("serves profiles and reports an unreachable analyzer bridge cleanly", async () => {
    process.env.HIGHLIGHTSMITH_ANALYZER_URL = "http://127.0.0.1:1";
    const app = await buildApp();

    try {
      const profilesResponse = await app.inject({
        method: "GET",
        url: "/api/profiles",
      });
      const bridgeResponse = await app.inject({
        method: "GET",
        url: "/api/bridge/analyzer",
      });

      const profilesPayload = profilesResponse.json() as {
        profiles: Array<{ id: string }>;
      };

      assert.equal(profilesResponse.statusCode, 200);
      assert.equal(profilesPayload.profiles.length, 4);

      assert.equal(bridgeResponse.statusCode, 200);
      assert.deepEqual(bridgeResponse.json(), {
        analyzer: "unreachable",
        payload: null,
      });
    } finally {
      await app.close();
    }
  });
});
