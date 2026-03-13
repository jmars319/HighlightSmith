import { startTransition, useEffect, useState } from "react";
import { buildProjectSummary } from "@highlightsmith/domain";
import { contentProfiles } from "@highlightsmith/profiles";
import {
  createMockProjectSessions,
  createMockReviewHistory,
  type CandidateWindow,
  type ContentProfile,
  type ProjectSession,
} from "@highlightsmith/shared-types";
import {
  CandidateCard,
  LayoutShell,
  TranscriptSnippetBlock,
} from "@highlightsmith/ui";

type WebPage =
  | "dashboard"
  | "projects"
  | "candidate-history"
  | "profiles"
  | "settings";

const navItems: Array<{ id: WebPage; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "projects", label: "Projects" },
  { id: "candidate-history", label: "Candidate History" },
  { id: "profiles", label: "Profiles" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [activePage, setActivePage] = useState<WebPage>("dashboard");
  const [sessions, setSessions] = useState<ProjectSession[]>(
    createMockProjectSessions(),
  );
  const [apiStatus, setApiStatus] = useState("local mock");

  useEffect(() => {
    const controller = new AbortController();
    const apiBaseUrl =
      import.meta.env.VITE_HIGHLIGHTSMITH_API_BASE_URL ??
      "http://127.0.0.1:4010";

    fetch(`${apiBaseUrl}/health`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        startTransition(() => {
          setApiStatus(payload.status ?? "online");
        });
      })
      .catch(() => {
        startTransition(() => {
          setApiStatus("local mock");
        });
      });

    return () => controller.abort();
  }, []);

  function renderPage() {
    if (activePage === "projects") {
      return (
        <section className="web-grid">
          {sessions.map((session) => {
            const summary = buildProjectSummary(session);
            return (
              <article className="web-panel" key={session.id}>
                <span className="web-label">Project</span>
                <h2>{summary.title}</h2>
                <p>{summary.mediaPath}</p>
                <p>
                  {summary.candidateCount} candidates • {summary.acceptedCount}{" "}
                  accepted
                </p>
              </article>
            );
          })}
        </section>
      );
    }

    if (activePage === "candidate-history") {
      const history = createMockReviewHistory();
      const primarySession = sessions[0];
      return (
        <section className="web-grid">
          {primarySession.candidates.map((candidate) => {
            const decision = history.find(
              (entry) => entry.candidateId === candidate.id,
            );
            return (
              <CandidateCard
                candidate={candidate}
                footerText={`Decision: ${decision?.action ?? "PENDING"}`}
                key={candidate.id}
                label={decision?.label ?? candidate.editableLabel}
                secondaryText={candidate.transcriptSnippet}
              />
            );
          })}
        </section>
      );
    }

    if (activePage === "profiles") {
      return (
        <section className="web-grid">
          {contentProfiles.map((profile) => (
            <article className="web-panel" key={profile.id}>
              <span className="web-label">{profile.mode}</span>
              <h2>{profile.label}</h2>
              <p>{profile.description}</p>
              <p>
                {Object.keys(profile.signalWeights).length} signal weights
                scaffolded
              </p>
            </article>
          ))}
        </section>
      );
    }

    if (activePage === "settings") {
      return (
        <section className="web-grid">
          <article className="web-panel">
            <span className="web-label">Bridge defaults</span>
            <p>API status: {apiStatus}</p>
            <p>Webapp stays complementary and does not act as the backend.</p>
          </article>
          <article className="web-panel">
            <span className="web-label">Future role</span>
            <p>
              Candidate history, profile inspection, and collaboration/review
              workflows can evolve here without turning the browser app into the
              core analysis engine.
            </p>
          </article>
        </section>
      );
    }

    const primary = sessions[0];
    const highlightedCandidate = primary.candidates[0];

    return (
      <section className="web-grid">
        <article className="web-panel">
          <span className="web-label">Dashboard</span>
          <h2>{primary.title}</h2>
          <p>
            Complementary view for project browsing, candidate history, and
            profile inspection. Current data source: {apiStatus}.
          </p>
        </article>
        <CandidateCard
          candidate={highlightedCandidate}
          footerText="Mock candidate surfaced from the shared types package"
          label={highlightedCandidate.editableLabel}
          secondaryText={highlightedCandidate.reasonCodes.join(", ")}
        />
        <TranscriptSnippetBlock
          heading="Current transcript focus"
          text={highlightedCandidate.transcriptSnippet}
        />
      </section>
    );
  }

  return (
    <div className="web-shell">
      <LayoutShell
        activeId={activePage}
        appName="Webapp"
        aside={
          <div className="web-aside">
            <article className="web-panel">
              <span className="web-label">Companion surface</span>
              <p>{sessions.length} mock project sessions available</p>
            </article>
          </div>
        }
        navItems={navItems}
        onSelect={(pageId) => setActivePage(pageId as WebPage)}
        subtitle="Browser companion for history, profile inspection, and future collaborative review."
        title="HighlightSmith Web"
      >
        {renderPage()}
      </LayoutShell>
    </div>
  );
}
