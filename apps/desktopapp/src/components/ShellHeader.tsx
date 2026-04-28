type ShellHeaderProps = {
  currentProfileLabel: string;
  currentSessionLabel: string;
  selectedMediaPath: string;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  totalCount: number;
  activeSessionStateLabel: string;
  themeMode: "dark" | "light";
  onPickMedia: () => Promise<void> | void;
  onToggleTheme: () => void;
};

export function ShellHeader({
  currentProfileLabel,
  currentSessionLabel,
  selectedMediaPath,
  acceptedCount,
  rejectedCount,
  pendingCount,
  totalCount,
  activeSessionStateLabel,
  themeMode,
  onPickMedia,
  onToggleTheme,
}: ShellHeaderProps) {
  const selectedVideoLabel = selectedMediaPath
    ? extractFileLabel(selectedMediaPath)
    : "No video chosen";
  const reviewProgressLabel =
    totalCount === 0
      ? "No review yet"
      : pendingCount === 0
        ? "Review complete"
        : `${pendingCount} still need review`;

  return (
    <header className="workspace-header glass-panel">
      <div className="workspace-header-main">
        <div>
          <p className="eyebrow">HighlightSmith</p>
          <h1 className="workspace-title">Clip review workspace</h1>
          <p className="workspace-copy">
            Scan one video, review likely moments quickly, and keep the full
            process on your own machine.
          </p>
        </div>

        <div className="hero-actions">
          <button className="button-primary" onClick={onPickMedia} type="button">
            Choose video
          </button>
          <button
            aria-label={
              themeMode === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            className="button-secondary"
            onClick={onToggleTheme}
            type="button"
          >
            {themeMode === "dark" ? "Switch to Light" : "Switch to Dark"}
          </button>
        </div>
      </div>

      <div className="workspace-status-grid">
        <div className="stat-card compact">
          <span className="stat-label">Current video</span>
          <strong>{selectedVideoLabel}</strong>
          <p>{selectedMediaPath || "Choose a file to start a scan."}</p>
        </div>
        <div className="stat-card compact">
          <span className="stat-label">Reference profile</span>
          <strong>{currentProfileLabel}</strong>
          <p>{activeSessionStateLabel}</p>
        </div>
        <div className="stat-card compact">
          <span className="stat-label">Review progress</span>
          <strong>{reviewProgressLabel}</strong>
          <p>
            {acceptedCount} kept • {rejectedCount} skipped • {pendingCount} left
          </p>
        </div>
        <div className="stat-card compact">
          <span className="stat-label">Current session</span>
          <strong>{currentSessionLabel}</strong>
          <p>
            {totalCount === 0
              ? "No review queue loaded yet."
              : `${totalCount} total suggested moments`}
          </p>
        </div>
      </div>
    </header>
  );
}

function extractFileLabel(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  return normalizedPath.split("/").pop() || path;
}
