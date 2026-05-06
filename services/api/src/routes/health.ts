import type { FastifyPluginAsync } from "fastify";
import { homedir } from "node:os";
import { join } from "node:path";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => ({
    service: "api",
    status: "ok",
    mode: "local-bridge",
    localRuntime: {
      contractVersion: 1,
      mode: "local-first",
      state: "ready",
      appStorageDir: join(
        homedir(),
        "Library",
        "Application Support",
        "vaexcore pulse",
      ),
      suiteDir: join(
        homedir(),
        "Library",
        "Application Support",
        "vaexcore",
        "suite",
      ),
      secureStorage: "none-required",
      secretStorageState: "not-applicable",
      durableStorage: [
        "SQLite review and media library data",
        "local analyzer/API service logs",
        "Studio handoff manifests",
      ],
      networkPolicy: "localhost-only",
      dependencies: [
        {
          name: "pulse-analyzer",
          kind: "local-http-service",
          state: "managed-by-desktop-or-dev",
          detail:
            "The API bridge calls the local analyzer service when analysis is requested.",
        },
        {
          name: "ffmpeg",
          kind: "local-binary",
          state: "optional",
          detail:
            "Used by local probing, thumbnail, and future offline analysis paths.",
        },
      ],
    },
  }));
};
