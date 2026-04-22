import type { FastifyPluginAsync } from "fastify";
import { requestAnalyzerHealth } from "../lib/analyzer.js";

export const bridgeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/bridge/analyzer", async () => {
    try {
      const payload = await requestAnalyzerHealth();
      return {
        analyzer: "reachable",
        payload,
      };
    } catch {
      return {
        analyzer: "unreachable",
        payload: null,
      };
    }
  });
};
