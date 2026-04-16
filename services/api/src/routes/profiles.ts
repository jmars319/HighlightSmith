import type { FastifyPluginAsync } from "fastify";
import {
  addExampleClipRequestSchema,
  createClipProfileRequestSchema,
} from "@highlightsmith/shared-types";
import {
  addProfileExample,
  AnalyzerBridgeError,
  createProfile,
  requestProfileExamples,
  requestProfiles,
} from "../lib/analyzer.js";

export const profileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/profiles", async (_request, reply) => {
    try {
      const profiles = await requestProfiles();
      return reply.code(200).send(profiles);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "profile_list_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "profile_list_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.post("/api/profiles", async (request, reply) => {
    const parsedRequest = createClipProfileRequestSchema.safeParse(
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
      const profile = await createProfile(parsedRequest.data);
      return reply.code(200).send(profile);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "profile_create_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "profile_create_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.get("/api/profiles/:profileId/examples", async (request, reply) => {
    const profileId = String(
      (request.params as { profileId?: string }).profileId ?? "",
    ).trim();
    if (!profileId) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "profileId is required",
      });
    }

    try {
      const examples = await requestProfileExamples(profileId);
      return reply.code(200).send(examples);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "profile_examples_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "profile_examples_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });

  fastify.post("/api/profiles/:profileId/examples", async (request, reply) => {
    const profileId = String(
      (request.params as { profileId?: string }).profileId ?? "",
    ).trim();
    if (!profileId) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "profileId is required",
      });
    }

    const parsedRequest = addExampleClipRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      return reply.code(400).send({
        error: "invalid_request",
        message:
          parsedRequest.error.issues[0]?.message ?? "Invalid request body",
      });
    }

    try {
      const example = await addProfileExample(profileId, parsedRequest.data);
      return reply.code(200).send(example);
    } catch (error) {
      if (error instanceof AnalyzerBridgeError) {
        const statusCode = error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({
          error: "profile_example_create_failed",
          message: error.message,
        });
      }

      return reply.code(500).send({
        error: "profile_example_create_failed",
        message: "Unexpected analyzer bridge failure",
      });
    }
  });
};
