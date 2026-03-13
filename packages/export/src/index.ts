import type {
  CandidateWindow,
  MediaSource,
  ReviewDecision,
} from "@highlightsmith/shared";

export function toJsonCandidateExport(
  mediaSource: MediaSource,
  candidates: CandidateWindow[],
  decisions: ReviewDecision[],
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      mediaSource,
      candidates,
      decisions,
    },
    null,
    2,
  );
}

export function toTimestampExport(
  candidates: CandidateWindow[],
  decisions: ReviewDecision[],
): string {
  const decisionByCandidateId = new Map(
    decisions.map((decision) => [decision.candidateId, decision]),
  );

  return candidates
    .filter((candidate) => {
      const decision = decisionByCandidateId.get(candidate.id);
      return !decision || decision.action === "ACCEPT";
    })
    .map((candidate) => {
      const decision = decisionByCandidateId.get(candidate.id);
      const startSeconds =
        decision?.adjustedSegment?.startSeconds ??
        candidate.suggestedSegment.startSeconds;
      const endSeconds =
        decision?.adjustedSegment?.endSeconds ??
        candidate.suggestedSegment.endSeconds;
      const label = decision?.label ?? candidate.editableLabel;

      return `${formatTimecode(startSeconds)} - ${formatTimecode(endSeconds)}  ${label}`;
    })
    .join("\n");
}

function formatTimecode(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}
