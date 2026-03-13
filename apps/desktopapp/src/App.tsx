import { startTransition, useDeferredValue, useMemo, useState } from "react";
import {
  acceptedCandidates,
  buildProjectSummary,
  filterCandidates,
} from "@highlightsmith/domain";
import {
  toJsonCandidateExport,
  toTimestampExport,
} from "@highlightsmith/export";
import {
  isSupportedInput,
  supportedInputExtensions,
} from "@highlightsmith/media";
import { contentProfiles, getProfileById } from "@highlightsmith/profiles";
import {
  createMockProjectSessions,
  createMockProjectSession,
  type ConfidenceBand,
} from "@highlightsmith/shared-types";
import { sqliteSchemaVersion, sqliteTables } from "@highlightsmith/storage";
import { LayoutShell, TranscriptSnippetBlock } from "@highlightsmith/ui";
import { CandidateDetail } from "./components/CandidateDetail";
import { CandidateQueue } from "./components/CandidateQueue";
import { ShellHeader } from "./components/ShellHeader";
import { useReviewState } from "./hooks/useReviewState";
import { formatLongTime } from "./lib/format";

type FilterValue = ConfidenceBand | "ALL";
type DesktopPage =
  | "projects"
  | "new-analysis"
  | "candidate-review"
  | "candidate-detail"
  | "settings";

const mockSessionFactory = () => createMockProjectSession();
const desktopPages: Array<{ id: DesktopPage; label: string }> = [
  { id: "projects", label: "Projects" },
  { id: "new-analysis", label: "New Analysis" },
  { id: "candidate-review", label: "Candidate Review" },
  { id: "candidate-detail", label: "Candidate Detail" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [activePage, setActivePage] = useState<DesktopPage>("candidate-review");
  const [projectSession, setProjectSession] = useState(mockSessionFactory);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    projectSession.candidates[0]?.id ?? null,
  );
  const [searchValue, setSearchValue] = useState("");
  const [bandFilter, setBandFilter] = useState<FilterValue>("ALL");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      projectSession.candidates.map((candidate) => [
        candidate.id,
        candidate.editableLabel,
      ]),
    ),
  );
  const [selectedMediaPath, setSelectedMediaPath] = useState(
    projectSession.mediaSource.path,
  );

  const deferredSearchValue = useDeferredValue(searchValue);
  const currentProfile = getProfileById(projectSession.profileId);
  const { decisionsByCandidateId, upsertDecision, clearAll } = useReviewState(
    projectSession.id,
  );

  const filteredCandidates = useMemo(() => {
    return filterCandidates(
      projectSession.candidates,
      deferredSearchValue,
      bandFilter,
      decisionsByCandidateId,
    );
  }, [bandFilter, deferredSearchValue, labelDrafts, projectSession.candidates]);

  const selectedCandidate =
    filteredCandidates.find(
      (candidate) => candidate.id === selectedCandidateId,
    ) ??
    projectSession.candidates.find(
      (candidate) => candidate.id === selectedCandidateId,
    ) ??
    filteredCandidates[0] ??
    null;

  const selectedDecision = selectedCandidate
    ? decisionsByCandidateId[selectedCandidate.id]
    : undefined;

  const acceptedCount = acceptedCandidates(
    projectSession.candidates,
    decisionsByCandidateId,
  ).length;

  const timestampPreview = toTimestampExport(
    projectSession.candidates,
    Object.values(decisionsByCandidateId),
  );

  const jsonPreview = toJsonCandidateExport(
    projectSession.mediaSource,
    projectSession.candidates,
    Object.values(decisionsByCandidateId),
  );

  async function handlePickMedia() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selection = await open({
        directory: false,
        multiple: false,
        filters: [
          {
            name: "Media",
            extensions: supportedInputExtensions.map((extension) =>
              extension.slice(1),
            ),
          },
        ],
      });

      if (typeof selection === "string" && isSupportedInput(selection)) {
        setSelectedMediaPath(selection);
        return;
      }

      if (typeof selection === "string") {
        setSelectedMediaPath(`${selection} (unsupported extension)`);
        return;
      }
    } catch {
      setSelectedMediaPath(
        `${projectSession.mediaSource.path} (Tauri dialog becomes active in desktop mode)`,
      );
    }
  }

  function handleReloadMock() {
    const nextSession = mockSessionFactory();
    setProjectSession(nextSession);
    setSelectedCandidateId(nextSession.candidates[0]?.id ?? null);
    setLabelDrafts(
      Object.fromEntries(
        nextSession.candidates.map((candidate) => [
          candidate.id,
          candidate.editableLabel,
        ]),
      ),
    );
    setSelectedMediaPath(nextSession.mediaSource.path);
    clearAll();
  }

  function handleSearchChange(nextValue: string) {
    startTransition(() => {
      setSearchValue(nextValue);
    });
  }

  function handleSelectCandidate(candidateId: string) {
    startTransition(() => {
      setSelectedCandidateId(candidateId);
    });
  }

  function handleLabelChange(nextValue: string) {
    if (!selectedCandidate) {
      return;
    }

    setLabelDrafts((current) => ({
      ...current,
      [selectedCandidate.id]: nextValue,
    }));
  }

  function handleSaveLabel() {
    if (!selectedCandidate) {
      return;
    }

    upsertDecision(selectedCandidate, "RELABEL", {
      label: labelDrafts[selectedCandidate.id],
    });
  }

  function handleAccept() {
    if (!selectedCandidate) {
      return;
    }

    upsertDecision(selectedCandidate, "ACCEPT", {
      label: labelDrafts[selectedCandidate.id],
    });
  }

  function handleReject() {
    if (!selectedCandidate) {
      return;
    }

    upsertDecision(selectedCandidate, "REJECT", {
      label: labelDrafts[selectedCandidate.id],
    });
  }

  function handleExpandSetup() {
    if (!selectedCandidate) {
      return;
    }

    const currentSegment =
      decisionsByCandidateId[selectedCandidate.id]?.adjustedSegment ??
      selectedCandidate.suggestedSegment;

    upsertDecision(selectedCandidate, "RETIME", {
      adjustedSegment: {
        startSeconds: Math.max(0, currentSegment.startSeconds - 2),
        endSeconds: currentSegment.endSeconds,
      },
      label: labelDrafts[selectedCandidate.id],
    });
  }

  function handleExpandResolution() {
    if (!selectedCandidate) {
      return;
    }

    const currentSegment =
      decisionsByCandidateId[selectedCandidate.id]?.adjustedSegment ??
      selectedCandidate.suggestedSegment;

    upsertDecision(selectedCandidate, "RETIME", {
      adjustedSegment: {
        startSeconds: currentSegment.startSeconds,
        endSeconds: Math.min(
          projectSession.mediaSource.durationSeconds,
          currentSegment.endSeconds + 2,
        ),
      },
      label: labelDrafts[selectedCandidate.id],
    });
  }

  function renderDesktopPage() {
    if (activePage === "projects") {
      return (
        <section className="desktop-placeholder-grid">
          {createMockProjectSessions().map((session) => {
            const summary = buildProjectSummary(session);
            return (
              <article className="utility-block" key={session.id}>
                <span className="detail-label">Project session</span>
                <h2>{summary.title}</h2>
                <p>{summary.mediaPath}</p>
                <p>
                  {summary.candidateCount} candidates • {summary.acceptedCount}{" "}
                  accepted • updated {summary.updatedAt}
                </p>
              </article>
            );
          })}
        </section>
      );
    }

    if (activePage === "new-analysis") {
      return (
        <section className="desktop-placeholder-grid">
          <article className="utility-block">
            <span className="detail-label">Analysis launch control</span>
            <h2>Local ingest first</h2>
            <p>
              Desktopapp owns local media selection, project/session creation,
              and analysis launch orchestration. FFmpeg and analyzer handoff
              stay stubbed until the next pass.
            </p>
            <p>Supported targets: {supportedInputExtensions.join(", ")}</p>
          </article>
          <article className="utility-block">
            <span className="detail-label">Planned sequence</span>
            <ol className="plain-list ordered">
              <li>Select a local recording.</li>
              <li>Create a project session.</li>
              <li>Dispatch analyzer orchestration.</li>
              <li>Open candidate review on completion.</li>
            </ol>
          </article>
        </section>
      );
    }

    if (activePage === "candidate-detail") {
      return (
        <CandidateDetail
          candidate={selectedCandidate}
          decision={selectedDecision}
          exportPreview={timestampPreview}
          labelDraft={
            selectedCandidate ? (labelDrafts[selectedCandidate.id] ?? "") : ""
          }
          onAccept={handleAccept}
          onExpandResolution={handleExpandResolution}
          onExpandSetup={handleExpandSetup}
          onLabelChange={handleLabelChange}
          onReject={handleReject}
          onSaveLabel={handleSaveLabel}
          profile={currentProfile}
        />
      );
    }

    if (activePage === "settings") {
      return (
        <section className="desktop-placeholder-grid">
          <article className="utility-block">
            <span className="detail-label">Current analyzer defaults</span>
            <p>
              Offline only: {String(projectSession.settings.runOfflineOnly)} •
              micro window {projectSession.settings.microWindowSeconds}s •
              candidate window{" "}
              {projectSession.settings.candidateWindowMinSeconds}-
              {projectSession.settings.candidateWindowMaxSeconds}s
            </p>
          </article>
          <article className="utility-block">
            <span className="detail-label">Storage direction</span>
            <p>
              SQLite schema v{sqliteSchemaVersion} with {sqliteTables.length}{" "}
              planned tables. Desktop review actions still fall back to local
              browser state in the scaffold.
            </p>
          </article>
        </section>
      );
    }

    return (
      <section className="desktop-review-grid">
        <CandidateQueue
          bandFilter={bandFilter}
          candidates={filteredCandidates}
          decisionsByCandidateId={decisionsByCandidateId}
          deferredSearchValue={deferredSearchValue}
          onBandFilterChange={setBandFilter}
          onSearchChange={handleSearchChange}
          onSelectCandidate={handleSelectCandidate}
          profile={currentProfile}
          searchValue={searchValue}
          selectedCandidateId={selectedCandidate?.id ?? null}
        />

        <CandidateDetail
          candidate={selectedCandidate}
          decision={selectedDecision}
          exportPreview={timestampPreview}
          labelDraft={
            selectedCandidate ? (labelDrafts[selectedCandidate.id] ?? "") : ""
          }
          onAccept={handleAccept}
          onExpandResolution={handleExpandResolution}
          onExpandSetup={handleExpandSetup}
          onLabelChange={handleLabelChange}
          onReject={handleReject}
          onSaveLabel={handleSaveLabel}
          profile={currentProfile}
        />
      </section>
    );
  }

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />

      <LayoutShell
        activeId={activePage}
        appName="Desktopapp"
        aside={
          <div className="desktop-aside-stack">
            <article className="utility-block">
              <span className="detail-label">Current source</span>
              <p>{selectedMediaPath}</p>
              <p>
                {projectSession.candidates.length} candidates • {acceptedCount}{" "}
                accepted
              </p>
            </article>
            <TranscriptSnippetBlock
              heading="Current transcript focus"
              text={
                selectedCandidate?.transcriptSnippet ??
                "Select a candidate to inspect transcript context."
              }
            />
            <article className="utility-block">
              <span className="detail-label">Export preview</span>
              <details>
                <summary>Timestamp export</summary>
                <pre>{timestampPreview}</pre>
              </details>
              <details>
                <summary>JSON candidate export</summary>
                <pre>{jsonPreview}</pre>
              </details>
            </article>
          </div>
        }
        navItems={desktopPages}
        onSelect={(pageId) => setActivePage(pageId as DesktopPage)}
        subtitle="Primary local-first surface for project creation, analysis launch, and candidate review."
        title="HighlightSmith Desktop"
      >
        <ShellHeader
          acceptedCount={acceptedCount}
          currentProfileLabel={currentProfile.label}
          onPickMedia={handlePickMedia}
          onReloadMock={handleReloadMock}
          selectedMediaPath={selectedMediaPath}
          totalCount={projectSession.candidates.length}
        />
        {renderDesktopPage()}
      </LayoutShell>
    </div>
  );
}
