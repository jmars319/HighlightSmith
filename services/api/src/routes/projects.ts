import type { FastifyPluginAsync } from "fastify";
import { buildProjectSummary } from "@highlightsmith/domain";
import { createMockProjectSessions } from "@highlightsmith/shared-types";

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/projects", async () =>
    createMockProjectSessions().map(buildProjectSummary),
  );

  fastify.get("/api/candidates/current", async () => {
    const session = createMockProjectSessions()[0];
    return {
      projectId: session.id,
      candidates: session.candidates,
    };
  });
};
