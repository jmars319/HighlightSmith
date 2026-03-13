import type { FastifyPluginAsync } from "fastify";
import { contentProfiles } from "@highlightsmith/profiles";

export const profileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/profiles", async () => ({
    profiles: contentProfiles,
  }));
};
