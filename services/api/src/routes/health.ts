import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => ({
    service: "api",
    status: "ok",
    mode: "local-bridge",
  }));
};
