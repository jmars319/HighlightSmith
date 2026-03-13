import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { toJsonCandidateExport, toTimestampExport } from "@highlightsmith/export";
import {
  isSupportedInput,
  supportedInputExtensions,
} from "@highlightsmith/media";
import { contentProfiles, getProfileById } from "@highlightsmith/profiles";
import { createMockProjectSession, type ConfidenceBand } from "@highlightsmith/shared";
import { sqliteSchemaVersion, sqliteTables } from "@highlightsmith/storage";
import { CandidateDetail } from "./components/CandidateDetail";
import { CandidateQueue } from "./components/CandidateQueue";
import { ShellHeader } from "./components/ShellHeader";
import { useReviewState } from "./hooks/useReviewState";
import { formatLongTime } from "./lib/format";

type FilterValue = ConfidenceBand | "ALL";

const mockSessionFactory = () => createMockProjectSession();

export default function App() {
  const [projectSession, setProjectSession] = useState(mockSessionFactory);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    projectSession.candidates[0]?.id ?? null,
  );
  const [searchValue, setSearchValue] = useState("");
  const [bandFilter, setBandFilter] = useState<FilterValue>("ALL");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      projectSession.candidates.map((candidate) => [candidate.id, candidate.editableLabel]),
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
    const normalizedQuery = deferredSearchValue.trim().toLowerCase();

    return projectSession.candidates.filter((candidate) => {
      if (bandFilter !== "ALL" && candidate.confidenceBand !== bandFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const label = labelDrafts[candidate.id] ?? candidate.editableLabel;
      const searchCorpus = [
        candidate.transcriptSnippet,
        label,
        candidate.reasonCodes.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return searchCorpus.includes(normalizedQuery);
    });
  }, [bandFilter, deferredSearchValue, labelDrafts, projectSession.candidates]);

  const selectedCandidate =
    filteredCandidates.find((candidate) => candidate.id === selectedCandidateId) ??
    projectSession.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    filteredCandidates[0] ??
    null;

  const selectedDecision = selectedCandidate
    ? decisionsByCandidateId[selectedCandidate.id]
    : undefined;

  const acceptedCount = Object.values(decisionsByCandidateId).filter(
    (decision) => decision.action === "ACCEPT",
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
            extensions: supportedInputExtensions.map((extension) => extension.slice(1)),
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
        nextSession.candidates.map((candidate) => [candidate.id, candidate.editableLabel]),
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

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />

      <ShellHeader
        acceptedCount={acceptedCount}
        currentProfileLabel={currentProfile.label}
        onPickMedia={handlePickMedia}
        onReloadMock={handleReloadMock}
        selectedMediaPath={selectedMediaPath}
        totalCount={projectSession.candidates.length}
      />

      <main className="workspace-grid">
        <aside className="utility-panel glass-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Foundation status</p>
              <h2>V0 scaffold</h2>
            </div>
          </div>

          <div className="utility-block">
            <span className="detail-label">What is real already</span>
            <ul className="plain-list">
              <li>Shared domain schemas for sessions, features, candidates, and review decisions</li>
              <li>Offline Python analyzer skeleton with SQLite persistence</li>
              <li>Reason-code aware review UI with local browser persistence</li>
            </ul>
          </div>

          <div className="utility-block">
            <span className="detail-label">Current profile pack</span>
            <ul className="plain-list">
              {contentProfiles.map((profile) => (
                <li key={profile.id}>
                  <strong>{profile.label}</strong>
                  <span>{profile.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="utility-block">
            <span className="detail-label">SQLite storage plan</span>
            <p>
              Schema v{sqliteSchemaVersion} with {sqliteTables.length} tables for
              sessions, candidate windows, review decisions, and analysis artifacts.
            </p>
          </div>

          <div className="utility-block">
            <span className="detail-label">Input target</span>
            <p>
              {supportedInputExtensions.join(", ")}. Current demo source runs for{" "}
              {formatLongTime(projectSession.mediaSource.durationSeconds)}.
            </p>
          </div>

          <div className="utility-block">
            <span className="detail-label">Export preview formats</span>
            <details>
              <summary>Timestamp export</summary>
              <pre>{timestampPreview}</pre>
            </details>
            <details>
              <summary>JSON candidate export</summary>
              <pre>{jsonPreview}</pre>
            </details>
          </div>
        </aside>

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
          labelDraft={selectedCandidate ? labelDrafts[selectedCandidate.id] ?? "" : ""}
          onAccept={handleAccept}
          onExpandResolution={handleExpandResolution}
          onExpandSetup={handleExpandSetup}
          onLabelChange={handleLabelChange}
          onReject={handleReject}
          onSaveLabel={handleSaveLabel}
          profile={currentProfile}
        />
      </main>
    </div>
  );
}
