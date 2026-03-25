import type { FastifyPluginAsync } from "fastify";
import { getAnalyzerUrl } from "../lib/analyzer.js";

export const bridgeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/bridge/analyzer", async () => {
    try {
      const response = await fetch(`${getAnalyzerUrl()}/health`);
      const payload = await response.json();
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
