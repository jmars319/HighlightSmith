import { useMemo, useState } from "react";
import type {
  CandidateWindow,
  ProjectSession,
  ReviewAction,
  ReviewDecision,
} from "@vaexcore/pulse-shared-types";
import {
  projectSessionSchema,
  reviewUpdateRequestSchema,
} from "@vaexcore/pulse-shared-types";
import { fetchWithLocalApiMessage } from "../lib/localApi";

type ReviewDecisionOverrides = Pick<
  ReviewDecision,
  "label" | "adjustedSegment" | "notes"
>;

type UseReviewStateOptions = {
  apiBaseUrl: string;
  projectSession: ProjectSession | null;
  onProjectSessionChange: (
    nextSession: ProjectSession,
    context: {
      action: ReviewAction;
      candidateId: string;
    },
  ) => void;
};

export function useReviewState({
  apiBaseUrl,
  projectSession,
  onProjectSessionChange,
}: UseReviewStateOptions) {
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isSavingReview, setIsSavingReview] = useState(false);

  const decisionsByCandidateId = useMemo<Record<string, ReviewDecision>>(() => {
    return Object.fromEntries(
      (projectSession?.reviewDecisions ?? []).map((decision) => [
        decision.candidateId,
        decision,
      ]),
    );
  }, [projectSession]);

  async function upsertDecision(
    candidate: CandidateWindow,
    action: ReviewAction,
    overrides: ReviewDecisionOverrides = {},
  ) {
    if (!projectSession || action === "PENDING") {
      return;
    }

    const request = reviewUpdateRequestSchema.parse({
      sessionId: projectSession.id,
      candidateId: candidate.id,
      action,
      label: overrides.label,
      adjustedSegment: overrides.adjustedSegment,
      notes: overrides.notes,
      timestamp: new Date().toISOString(),
    });

    setIsSavingReview(true);
    setReviewError(null);

    try {
      const response = await fetchWithLocalApiMessage(
        `${apiBaseUrl}/api/projects/review`,
        apiBaseUrl,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(request),
        },
        "Unable to save the review update.",
      );

      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
          }
        | ProjectSession
        | null;

      if (!response.ok) {
        throw new Error(
          payload && "message" in payload && payload.message
            ? payload.message
            : "Review update failed",
        );
      }

      const nextSession = projectSessionSchema.parse(payload);
      onProjectSessionChange(nextSession, {
        action,
        candidateId: candidate.id,
      });
    } catch (error) {
      setReviewError(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving your decision.",
      );
    } finally {
      setIsSavingReview(false);
    }
  }

  function clearError() {
    setReviewError(null);
  }

  return {
    decisionsByCandidateId,
    upsertDecision,
    reviewError,
    isSavingReview,
    clearError,
  };
}
