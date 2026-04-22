import type { FastifyPluginAsync } from "fastify";
import {
  cancelMediaAlignmentJobRequestSchema,
  cancelMediaIndexJobRequestSchema,
  createMediaAlignmentJobRequestSchema,
  createMediaEditPairRequestSchema,
  createMediaIndexJobRequestSchema,
  createMediaLibraryAssetRequestSchema,
} from "@highlightsmith/shared-types";
import {
  AnalyzerBridgeError,
  cancelMediaAlignmentJob,
  cancelMediaIndexJob,
  createMediaAlignmentJob,
  createMediaEditPair,
  createMediaIndexJob,
  createMediaLibraryAsset,
  requestMediaAlignmentJobs,
  requestMediaAlignmentMatches,
  requestMediaEditPairs,
  requestMediaIndexArtifacts,
  requestMediaIndexJobs,
  requestMediaLibraryAssets,
} from "../lib/analyzer.js";

export const libraryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/library/assets", async (_request, reply) => {
    try {
      const assets = await requestMediaLibraryAssets();
      return reply.code(200).send(assets);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "library_asset_list_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "library_asset_list_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.post("/api/library/assets", async (request, reply) => {
    const parsedRequest = createMediaLibraryAssetRequestSchema.safeParse(
      request.body,
    );
    if (!parsedRequest.success) {
      return reply.code(400).send({
        error: "invalid_request",
        message:
          parsedRequest.error.issues[0]?.message ?? "Invalid request body",
      });
    }

    try {
      const asset = await createMediaLibraryAsset(parsedRequest.data);
      return reply.code(200).send(asset);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "library_asset_create_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "library_asset_create_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.get("/api/library/pairs", async (_request, reply) => {
    try {
      const pairs = await requestMediaEditPairs();
      return reply.code(200).send(pairs);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "media_pair_list_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "media_pair_list_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.post("/api/library/pairs", async (request, reply) => {
    const parsedRequest = createMediaEditPairRequestSchema.safeParse(
      request.body,
    );
    if (!parsedRequest.success) {
      return reply.code(400).send({
        error: "invalid_request",
        message:
          parsedRequest.error.issues[0]?.message ?? "Invalid request body",
      });
    }

    try {
      const pair = await createMediaEditPair(parsedRequest.data);
      return reply.code(200).send(pair);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "media_pair_create_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "media_pair_create_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.get("/api/library/index-jobs", async (_request, reply) => {
    try {
      const jobs = await requestMediaIndexJobs();
      return reply.code(200).send(jobs);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "media_index_job_list_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "media_index_job_list_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.get("/api/library/index-artifacts", async (_request, reply) => {
    try {
      const artifacts = await requestMediaIndexArtifacts();
      return reply.code(200).send(artifacts);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "media_index_artifact_list_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "media_index_artifact_list_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.get(
    "/api/library/assets/:assetId/index-artifacts",
    async (request, reply) => {
      const params = request.params as { assetId?: string };
      if (!params.assetId) {
        return reply.code(400).send({
          error: "invalid_request",
          message: "assetId is required",
        });
      }

      try {
        const artifacts = await requestMediaIndexArtifacts(params.assetId);
        return reply.code(200).send(artifacts);
      } catch (error) {
        if (error instanceof AnalyzerBridgeError) {
          const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(statusCode).send({
            error: "media_index_artifact_list_failed",
            message: error.message,
          });
        }

        return reply.code(500).send({
          error: "media_index_artifact_list_failed",
          message: "Unexpected analyzer bridge failure",
        });
      }
    },
  );

  fastify.get("/api/library/alignment-jobs", async (_request, reply) => {
    try {
      const jobs = await requestMediaAlignmentJobs();
      return reply.code(200).send(jobs);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "media_alignment_job_list_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "media_alignment_job_list_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.get("/api/library/alignment-matches", async (_request, reply) => {
    try {
      const matches = await requestMediaAlignmentMatches();
      return reply.code(200).send(matches);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "media_alignment_match_list_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "media_alignment_match_list_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.get(
    "/api/library/pairs/:pairId/alignment-matches",
    async (request, reply) => {
      const params = request.params as { pairId?: string };
      if (!params.pairId) {
        return reply.code(400).send({
          error: "invalid_request",
          message: "pairId is required",
        });
      }

      try {
        const matches = await requestMediaAlignmentMatches(params.pairId);
        return reply.code(200).send(matches);
      } catch (error) {
        if (error instanceof AnalyzerBridgeError) {
          const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(statusCode).send({
            error: "media_alignment_match_list_failed",
            message: error.message,
          });
        }

        return reply.code(500).send({
          error: "media_alignment_match_list_failed",
          message: "Unexpected analyzer bridge failure",
        });
      }
    },
  );

  fastify.post("/api/library/alignment-jobs", async (request, reply) => {
    const parsedRequest = createMediaAlignmentJobRequestSchema.safeParse(
      request.body,
    );
    if (!parsedRequest.success) {
      return reply.code(400).send({
        error: "invalid_request",
        message:
          parsedRequest.error.issues[0]?.message ?? "Invalid request body",
      });
    }

    try {
      const job = await createMediaAlignmentJob(parsedRequest.data);
      return reply.code(200).send(job);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "media_alignment_job_create_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "media_alignment_job_create_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.post(
    "/api/library/pairs/:pairId/alignment-jobs",
    async (request, reply) => {
      const params = request.params as { pairId?: string };
      const parsedRequest = createMediaAlignmentJobRequestSchema.safeParse({
        pairId: params.pairId,
      });
      if (!parsedRequest.success) {
        return reply.code(400).send({
          error: "invalid_request",
          message:
            parsedRequest.error.issues[0]?.message ?? "Invalid request body",
        });
      }

      try {
        const job = await createMediaAlignmentJob(parsedRequest.data);
        return reply.code(200).send(job);
      } catch (error) {
        if (error instanceof AnalyzerBridgeError) {
          const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(statusCode).send({
            error: "media_alignment_job_create_failed",
            message: error.message,
          });
        }

        return reply.code(500).send({
          error: "media_alignment_job_create_failed",
          message: "Unexpected analyzer bridge failure",
        });
      }
    },
  );

  fastify.post(
    "/api/library/alignment-jobs/:jobId/cancel",
    async (request, reply) => {
      const params = request.params as { jobId?: string };
      const parsedRequest = cancelMediaAlignmentJobRequestSchema.safeParse({
        jobId: params.jobId,
      });
      if (!parsedRequest.success) {
        return reply.code(400).send({
          error: "invalid_request",
          message:
            parsedRequest.error.issues[0]?.message ?? "Invalid request body",
        });
      }

      try {
        const job = await cancelMediaAlignmentJob(parsedRequest.data);
        return reply.code(200).send(job);
      } catch (error) {
        if (error instanceof AnalyzerBridgeError) {
          const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(statusCode).send({
            error: "media_alignment_job_cancel_failed",
            message: error.message,
          });
        }

        return reply.code(500).send({
          error: "media_alignment_job_cancel_failed",
          message: "Unexpected analyzer bridge failure",
        });
      }
    },
  );

  fastify.post(
    "/api/library/assets/:assetId/index-jobs",
    async (request, reply) => {
      const params = request.params as { assetId?: string };
      const parsedRequest = createMediaIndexJobRequestSchema.safeParse({
        assetId: params.assetId,
      });
      if (!parsedRequest.success) {
        return reply.code(400).send({
          error: "invalid_request",
          message:
            parsedRequest.error.issues[0]?.message ?? "Invalid request body",
        });
      }

      try {
        const job = await createMediaIndexJob(parsedRequest.data);
        return reply.code(200).send(job);
      } catch (error) {
        if (error instanceof AnalyzerBridgeError) {
          const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(statusCode).send({
            error: "media_index_job_create_failed",
            message: error.message,
          });
        }

        return reply.code(500).send({
          error: "media_index_job_create_failed",
          message: "Unexpected analyzer bridge failure",
        });
      }
    },
  );

  fastify.post(
    "/api/library/index-jobs/:jobId/cancel",
    async (request, reply) => {
      const params = request.params as { jobId?: string };
      const parsedRequest = cancelMediaIndexJobRequestSchema.safeParse({
        jobId: params.jobId,
      });
      if (!parsedRequest.success) {
        return reply.code(400).send({
          error: "invalid_request",
          message:
            parsedRequest.error.issues[0]?.message ?? "Invalid request body",
        });
      }

      try {
        const job = await cancelMediaIndexJob(parsedRequest.data);
        return reply.code(200).send(job);
      } catch (error) {
        if (error instanceof AnalyzerBridgeError) {
          const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(statusCode).send({
            error: "media_index_job_cancel_failed",
            message: error.message,
          });
        }

        return reply.code(500).send({
          error: "media_index_job_cancel_failed",
          message: "Unexpected analyzer bridge failure",
        });
      }
    },
  );
};
