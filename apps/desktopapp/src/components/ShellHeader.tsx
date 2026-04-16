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
  return (
    <header className="hero-panel">
      <div>
        <p className="eyebrow">Desktop backlog workstation</p>
        <h1 className="hero-title">Review long-form recordings locally</h1>
        <p className="hero-copy">
          Run one local VOD through analysis, inspect suggested moments, and
          keep final editorial control while working through a backlog.
        </p>
      </div>

      <div className="hero-meta">
        <div className="stat-card">
          <span className="stat-label">Profile</span>
          <strong>{currentProfileLabel}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Session</span>
          <strong>{currentSessionLabel}</strong>
          <p>{activeSessionStateLabel}</p>
        </div>
        <div className="stat-card">
          <span className="stat-label">Review progress</span>
          <strong>
            {totalCount === 0
              ? "No queue loaded"
              : `${totalCount - pendingCount}/${totalCount} reviewed`}
          </strong>
          <p>
            {acceptedCount} accepted • {rejectedCount} rejected • {pendingCount}{" "}
            pending
          </p>
        </div>
        <div className="stat-card path-card">
          <span className="stat-label">Current source</span>
          <strong>{selectedMediaPath}</strong>
        </div>
        <div className="hero-actions">
          <button
            className="button-primary"
            onClick={onPickMedia}
            type="button"
          >
            Select Local Recording
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
    </header>
  );
}
