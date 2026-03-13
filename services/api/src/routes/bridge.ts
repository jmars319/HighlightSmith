import type { FastifyPluginAsync } from "fastify";

function getAnalyzerUrl() {
  return process.env.HIGHLIGHTSMITH_ANALYZER_URL ?? "http://127.0.0.1:9010";
}

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
