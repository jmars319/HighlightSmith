import { startTransition, useEffect, useMemo, useState } from "react";
import {
  deriveSessionReviewState,
  reviewedCandidateCount,
} from "@highlightsmith/domain";
import { contentProfiles } from "@highlightsmith/profiles";
import {
  projectSessionSummarySchema,
  type ProjectSessionSummary,
} from "@highlightsmith/shared-types";
import { LayoutShell } from "@highlightsmith/ui";

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
  const [sessionSummaries, setSessionSummaries] = useState<ProjectSessionSummary[]>(
    [],
  );
  const [apiStatus, setApiStatus] = useState("offline");
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const apiBaseUrl =
    import.meta.env.VITE_HIGHLIGHTSMITH_API_BASE_URL ?? "http://127.0.0.1:4010";

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiBaseUrl}/health`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        startTransition(() => {
          setApiStatus(payload.status ?? "online");
        });
      })
      .catch(() => {
        startTransition(() => {
          setApiStatus("offline");
        });
      });

    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSessionSummaries() {
      setIsLoadingSummaries(true);

      try {
        const response = await fetch(`${apiBaseUrl}/api/projects`, {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              message?: string;
            }
          | ProjectSessionSummary[]
          | null;

        if (!response.ok) {
          throw new Error(
            payload && "message" in payload && payload.message
              ? payload.message
              : "Project list load failed",
          );
        }

        const summaries = projectSessionSummarySchema.array().parse(payload);
        startTransition(() => {
          setSessionSummaries(summaries);
          setSummaryError(null);
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setSummaryError(
            error instanceof Error
              ? error.message
              : "Unable to load persisted sessions",
          );
          setSessionSummaries([]);
        });
      } finally {
        if (!controller.signal.aborted) {
          startTransition(() => {
            setIsLoadingSummaries(false);
          });
        }
      }
    }

    void loadSessionSummaries();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const sessionStats = useMemo(() => {
    const reviewedSessions = sessionSummaries.filter(
      (summary) => deriveSessionReviewState(summary) === "REVIEWED",
    ).length;
    const inProgressSessions = sessionSummaries.filter(
      (summary) => deriveSessionReviewState(summary) === "IN_PROGRESS",
    ).length;
    const pendingSessions = sessionSummaries.filter(
      (summary) => deriveSessionReviewState(summary) === "PENDING",
    ).length;
    const acceptedCandidates = sessionSummaries.reduce(
      (total, summary) => total + summary.acceptedCount,
      0,
    );

    return {
      reviewedSessions,
      inProgressSessions,
      pendingSessions,
      acceptedCandidates,
    };
  }, [sessionSummaries]);

  function renderSummaryCard(summary: ProjectSessionSummary) {
    const sessionReviewState = deriveSessionReviewState(summary);

    return (
      <article className="web-panel web-summary-card" key={summary.sessionId}>
        <div className="web-panel-row">
          <span className="web-label">Project session</span>
          <span
            className={`web-state-pill ${sessionReviewState.toLowerCase().replace("_", "-")}`}
          >
            {formatSessionReviewState(sessionReviewState)}
          </span>
        </div>
        <h2>{summary.sessionTitle}</h2>
        <p>{summary.sourceName}</p>
        <p>{summary.sourcePath}</p>
        <div className="web-summary-progress">
          <div className="web-summary-meter">
            <div
              className="web-summary-fill"
              style={{
                width: `${formatSessionCompletion(summary)}%`,
              }}
            />
          </div>
          <p>
            {reviewedCandidateCount(summary)} of {summary.candidateCount} reviewed
          </p>
        </div>
        <p>
          {summary.acceptedCount} accepted • {summary.rejectedCount} rejected •{" "}
          {summary.pendingCount} pending
        </p>
        <p>Updated {formatSummaryTimestamp(summary.updatedAt)}</p>
      </article>
    );
  }

  function renderPage() {
    if (activePage === "projects") {
      if (isLoadingSummaries) {
        return (
          <section className="web-grid">
            <article className="web-panel">
              <span className="web-label">Projects</span>
              <h2>Loading persisted sessions...</h2>
            </article>
          </section>
        );
      }

      if (summaryError) {
        return (
          <section className="web-grid">
            <article className="web-panel">
              <span className="web-label">Projects</span>
              <h2>Real session list unavailable</h2>
              <p>{summaryError}</p>
            </article>
          </section>
        );
      }

      if (sessionSummaries.length === 0) {
        return (
          <section className="web-grid">
            <article className="web-panel">
              <span className="web-label">Projects</span>
              <h2>No persisted sessions yet</h2>
              <p>
                Run desktop analysis first. The web app stays a companion list,
                not the primary operator surface.
              </p>
            </article>
          </section>
        );
      }

      return <section className="web-grid">{sessionSummaries.map(renderSummaryCard)}</section>;
    }

    if (activePage === "candidate-history") {
      return (
        <section className="web-grid">
          <article className="web-panel">
            <span className="web-label">Candidate history</span>
            <h2>Desktop remains the review surface</h2>
            <p>
              This companion view now uses real project summaries, but candidate
              history and full session review still stay on desktop for now.
            </p>
            <p>
              Persisted sessions available: {sessionSummaries.length} • API
              status: {apiStatus}
            </p>
          </article>
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
            <p>Summary data source: real persisted `/api/projects` sessions.</p>
          </article>
          <article className="web-panel">
            <span className="web-label">Future role</span>
            <p>
              Project browsing is real here now. Full review stays on desktop
              until a clearly useful companion flow exists.
            </p>
          </article>
        </section>
      );
    }

    const latestSession = sessionSummaries[0] ?? null;

    return (
      <section className="web-grid">
        <article className="web-panel">
          <span className="web-label">Dashboard</span>
          <h2>Backlog companion</h2>
          <p>
            Browser surface for checking real persisted session summaries while
            desktop stays the primary review workstation.
          </p>
          <p>API status: {apiStatus}</p>
        </article>
        <article className="web-panel">
          <span className="web-label">Backlog totals</span>
          <h2>{sessionSummaries.length} persisted sessions</h2>
          <p>
            {sessionStats.inProgressSessions} in progress •{" "}
            {sessionStats.reviewedSessions} reviewed •{" "}
            {sessionStats.pendingSessions} not started
          </p>
          <p>{sessionStats.acceptedCandidates} accepted candidates so far</p>
        </article>
        <article className="web-panel">
          <span className="web-label">Latest session</span>
          {latestSession ? (
            <>
              <h2>{latestSession.sessionTitle}</h2>
              <p>{latestSession.sourceName}</p>
              <p>
                {formatSessionReviewState(deriveSessionReviewState(latestSession))}
                {" • "}
                {latestSession.pendingCount} pending
              </p>
            </>
          ) : (
            <>
              <h2>No sessions yet</h2>
              <p>Run desktop analysis to populate the companion dashboard.</p>
            </>
          )}
        </article>
        {summaryError ? (
          <article className="web-panel">
            <span className="web-label">Load state</span>
            <h2>Summary list unavailable</h2>
            <p>{summaryError}</p>
          </article>
        ) : null}
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
              <p>{sessionSummaries.length} persisted sessions loaded</p>
              <p>
                {sessionSummaries[0]
                  ? `Latest update ${formatSummaryTimestamp(sessionSummaries[0].updatedAt)}`
                  : "Desktop analysis will populate this list."}
              </p>
            </article>
          </div>
        }
        navItems={navItems}
        onSelect={(pageId) => setActivePage(pageId as WebPage)}
        subtitle="Browser companion for project browsing, profile inspection, and later lightweight status review."
        title="HighlightSmith Web"
      >
        {renderPage()}
      </LayoutShell>
    </div>
  );
}

function formatSessionReviewState(
  sessionReviewState: ReturnType<typeof deriveSessionReviewState>,
): string {
  if (sessionReviewState === "REVIEWED") {
    return "Reviewed";
  }

  if (sessionReviewState === "IN_PROGRESS") {
    return "In progress";
  }

  return "Pending";
}

function formatSessionCompletion(summary: ProjectSessionSummary): number {
  if (summary.candidateCount === 0) {
    return 0;
  }

  return Math.round(
    (reviewedCandidateCount(summary) / summary.candidateCount) * 100,
  );
}

function formatSummaryTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
