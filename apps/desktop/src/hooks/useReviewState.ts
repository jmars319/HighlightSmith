import { useEffect, useState } from "react";
import type { CandidateWindow, ReviewDecision, ReviewAction } from "@highlightsmith/shared";

const storageKeyPrefix = "highlightsmith.review.decisions";

function buildDecisionId(candidateId: string, action: ReviewAction): string {
  return `${candidateId}:${action}:${Date.now()}`;
}

export function useReviewState(projectSessionId: string) {
  const storageKey = `${storageKeyPrefix}.${projectSessionId}`;

  const [decisionsByCandidateId, setDecisionsByCandidateId] = useState<
    Record<string, ReviewDecision>
  >(() => {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return {};
    }

    try {
      return JSON.parse(rawValue) as Record<string, ReviewDecision>;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(decisionsByCandidateId),
    );
  }, [decisionsByCandidateId, storageKey]);

  function upsertDecision(
    candidate: CandidateWindow,
    action: ReviewAction,
    overrides: Partial<ReviewDecision> = {},
  ) {
    setDecisionsByCandidateId((current) => ({
      ...current,
      [candidate.id]: {
        id: buildDecisionId(candidate.id, action),
        projectSessionId,
        candidateId: candidate.id,
        action,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
    }));
  }

  function clearAll() {
    setDecisionsByCandidateId({});
  }

  return {
    decisionsByCandidateId,
    upsertDecision,
    clearAll,
  };
}
