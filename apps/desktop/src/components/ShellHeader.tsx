type ShellHeaderProps = {
  currentProfileLabel: string;
  selectedMediaPath: string;
  acceptedCount: number;
  totalCount: number;
  onPickMedia: () => Promise<void> | void;
  onReloadMock: () => void;
};

export function ShellHeader({
  currentProfileLabel,
  selectedMediaPath,
  acceptedCount,
  totalCount,
  onPickMedia,
  onReloadMock,
}: ShellHeaderProps) {
  return (
    <header className="hero-panel">
      <div>
        <p className="eyebrow">Local-first highlight scouting</p>
        <h1>HighlightSmith</h1>
        <p className="hero-copy">
          Signal-driven review assistant for long-form recordings. Candidates are
          surfaced with explainable reason codes. Final editorial control stays
          with the creator.
        </p>
      </div>

      <div className="hero-meta">
        <div className="stat-card">
          <span className="stat-label">Profile</span>
          <strong>{currentProfileLabel}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Reviewed</span>
          <strong>
            {acceptedCount}/{totalCount} accepted
          </strong>
        </div>
        <div className="stat-card path-card">
          <span className="stat-label">Current source</span>
          <strong>{selectedMediaPath}</strong>
        </div>
        <div className="hero-actions">
          <button className="button-primary" onClick={onPickMedia} type="button">
            Select Local Recording
          </button>
          <button className="button-secondary" onClick={onReloadMock} type="button">
            Reload Mock Session
          </button>
        </div>
      </div>
    </header>
  );
}
