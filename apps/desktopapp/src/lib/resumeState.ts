import {
  defaultReviewQueueMode,
  filterCandidatesByReviewMode,
  type ReviewQueueMode,
} from "@vaexcore/pulse-domain";
import type { ProjectSession } from "@vaexcore/pulse-shared-types";

const sessionResumeStorageKeyPrefix =
  "vaexcore-pulse.desktop.session-resume-state.";

export type SessionResumeState = {
  selectedCandidateId: string | null;
  reviewQueueMode: ReviewQueueMode;
  queueIndex: number | null;
  updatedAt: string;
};

export function loadSessionResumeState(
  sessionId: string,
): SessionResumeState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(storageKey(sessionId));
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SessionResumeState>;
    if (
      parsed.reviewQueueMode !== "ONLY_PENDING" &&
      parsed.reviewQueueMode !== "ALL"
    ) {
      return null;
    }

    return {
      selectedCandidateId:
        typeof parsed.selectedCandidateId === "string"
          ? parsed.selectedCandidateId
          : null,
      reviewQueueMode: parsed.reviewQueueMode,
      queueIndex:
        typeof parsed.queueIndex === "number" &&
        Number.isInteger(parsed.queueIndex) &&
        parsed.queueIndex >= 0
          ? parsed.queueIndex
          : null,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveSessionResumeState(
  sessionId: string,
  state: SessionResumeState,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(sessionId), JSON.stringify(state));
}

export function resolveSessionResumeState(
  session: ProjectSession,
  storedState: SessionResumeState | null,
): {
  reviewQueueMode: ReviewQueueMode;
  selectedCandidateId: string | null;
} {
  const fallbackReviewQueueMode = defaultReviewQueueMode(session);
  const reviewQueueMode =
    storedState?.reviewQueueMode === "ONLY_PENDING" &&
    fallbackReviewQueueMode === "ALL"
      ? "ALL"
      : (storedState?.reviewQueueMode ?? fallbackReviewQueueMode);
  const visibleQueueCandidates = filterCandidatesByReviewMode(
    session.candidates,
    session,
    reviewQueueMode,
  );
  const selectedCandidateStillExists = storedState?.selectedCandidateId
    ? session.candidates.some(
        (candidate) => candidate.id === storedState.selectedCandidateId,
      )
    : false;
  const selectedCandidateStillVisible =
    reviewQueueMode === "ALL"
      ? selectedCandidateStillExists
      : storedState?.selectedCandidateId
        ? visibleQueueCandidates.some(
            (candidate) => candidate.id === storedState.selectedCandidateId,
          )
        : false;

  if (selectedCandidateStillExists && selectedCandidateStillVisible) {
    return {
      reviewQueueMode,
      selectedCandidateId: storedState?.selectedCandidateId ?? null,
    };
  }

  if (
    storedState?.queueIndex !== null &&
    storedState?.queueIndex !== undefined &&
    visibleQueueCandidates.length > 0
  ) {
    const boundedIndex = Math.min(
      storedState.queueIndex,
      visibleQueueCandidates.length - 1,
    );
    return {
      reviewQueueMode,
      selectedCandidateId: visibleQueueCandidates[boundedIndex]?.id ?? null,
    };
  }

  return {
    reviewQueueMode,
    selectedCandidateId:
      visibleQueueCandidates[0]?.id ?? session.candidates[0]?.id ?? null,
  };
}

function storageKey(sessionId: string): string {
  return `${sessionResumeStorageKeyPrefix}${sessionId}`;
}
