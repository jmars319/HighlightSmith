import { z } from "zod";
import {
  exampleClipSourceTypeSchema,
  profileStateSchema,
  reviewActionSchema,
  timeRangeSchema,
} from "./domain";

export const analyzeProjectRequestSchema = z.object({
  sourcePath: z.string().trim().min(1, "sourcePath is required"),
  profileId: z.string().trim().min(1).optional(),
  sessionTitle: z.string().trim().min(1).max(160).optional(),
});

export const reviewMutationActionSchema = reviewActionSchema.exclude([
  "PENDING",
]);

export const createClipProfileRequestSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  description: z.string().trim().max(2000).optional(),
  state: profileStateSchema.optional(),
});

export const addExampleClipRequestSchema = z.object({
  sourceType: exampleClipSourceTypeSchema,
  sourceValue: z.string().trim().min(1, "sourceValue is required").max(4000),
  title: z.string().trim().min(1).max(160).optional(),
  note: z.string().trim().min(1).max(2000).optional(),
});

export const reviewUpdateRequestSchema = z
  .object({
    sessionId: z.string().trim().min(1, "sessionId is required"),
    candidateId: z.string().trim().min(1, "candidateId is required"),
    action: reviewMutationActionSchema,
    label: z.string().trim().min(1).max(160).optional(),
    adjustedSegment: timeRangeSchema.optional(),
    notes: z.string().trim().min(1).max(2000).optional(),
    timestamp: z.string().trim().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.action === "RELABEL" && !value.label) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "label is required for RELABEL actions",
        path: ["label"],
      });
    }

    if (value.action === "RETIME" && !value.adjustedSegment) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "adjustedSegment is required for RETIME actions",
        path: ["adjustedSegment"],
      });
    }
  });

export type AnalyzeProjectRequest = z.infer<typeof analyzeProjectRequestSchema>;
export type ReviewMutationAction = z.infer<typeof reviewMutationActionSchema>;
export type ReviewUpdateRequest = z.infer<typeof reviewUpdateRequestSchema>;
export type CreateClipProfileRequest = z.infer<
  typeof createClipProfileRequestSchema
>;
export type AddExampleClipRequest = z.infer<typeof addExampleClipRequestSchema>;
