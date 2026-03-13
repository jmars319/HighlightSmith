import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMockProjectSession,
  type CandidateDecisionMap,
} from "@highlightsmith/shared-types";
import {
  acceptedCandidates,
  buildProjectSummary,
  filterCandidates,
  makeReviewDecision,
  resolveCandidateLabel,
} from "./index";

describe("domain helpers", () => {
  it("builds a stable project summary from a session", () => {
    const session = createMockProjectSession();
    session.reviewDecisions = [
      {
        id: "accept_candidate_001",
        projectSessionId: session.id,
        candidateId: session.candidates[0].id,
        action: "ACCEPT",
        createdAt: "2026-03-13T09:25:00.000Z",
      },
    ];

    const summary = buildProjectSummary(session);

    assert.deepEqual(summary, {
      id: session.id,
      title: session.title,
      profileId: "generic",
      candidateCount: session.candidates.length,
      acceptedCount: 1,
      mediaPath: session.mediaSource.path,
      updatedAt: session.updatedAt,
    });
  });

  it("filters by relabeled text and confidence band", () => {
    const session = createMockProjectSession();
    const relabeledDecision = {
      id: "relabel_candidate_004",
      projectSessionId: session.id,
      candidateId: "candidate_004",
      action: "RELABEL" as const,
      label: "Puzzle route setup",
      createdAt: "2026-03-13T09:28:00.000Z",
    };
    const decisionsByCandidateId: CandidateDecisionMap = {
      candidate_004: relabeledDecision,
    };

    const candidates = filterCandidates(
      session.candidates,
      "route",
      "EXPERIMENTAL",
      decisionsByCandidateId,
    );

    assert.equal(candidates.length, 1);
    assert.equal(
      resolveCandidateLabel(candidates[0], relabeledDecision),
      "Puzzle route setup",
    );
  });

  it("returns accepted candidates and shapes review decisions", () => {
    const session = createMockProjectSession();
    const accepted = makeReviewDecision(
      session.id,
      session.candidates[0].id,
      "ACCEPT",
      {
        label: session.candidates[0].editableLabel,
      },
    );
    const rejected = makeReviewDecision(
      session.id,
      session.candidates[1].id,
      "REJECT",
    );

    const acceptedOnly = acceptedCandidates(session.candidates, {
      [session.candidates[0].id]: accepted,
      [session.candidates[1].id]: rejected,
    });

    assert.ok(
      accepted.id.includes(`${session.id}:${session.candidates[0].id}:ACCEPT`),
    );
    assert.deepEqual(
      acceptedOnly.map((candidate) => candidate.id),
      [session.candidates[0].id],
    );
  });
});
