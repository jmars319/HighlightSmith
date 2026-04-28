type ReviewControlsProps = {
  labelDraft: string;
  onLabelChange: (value: string) => void;
  onAccept?: () => void;
  onReject?: () => void;
  onRetime?: () => void;
  onRelabel?: () => void;
  blockLabel?: string;
  showTimingAction?: boolean;
  showLabelEditor?: boolean;
  disabled?: boolean;
};

export function ReviewControls({
  labelDraft,
  onLabelChange,
  onAccept,
  onReject,
  onRetime,
  onRelabel,
  blockLabel = "Moment controls",
  showTimingAction = true,
  showLabelEditor = true,
  disabled = false,
}: ReviewControlsProps) {
  return (
    <section className="hs-block">
      <span className="hs-block-label">{blockLabel}</span>
      <div className="hs-controls-row hs-controls-row-actions">
        <button disabled={disabled} onClick={onAccept} type="button">
          Keep
        </button>
        <button disabled={disabled} onClick={onReject} type="button">
          Skip
        </button>
        {showTimingAction ? (
          <button disabled={disabled} onClick={onRetime} type="button">
            Adjust timing
          </button>
        ) : null}
      </div>
      {showLabelEditor ? (
        <div className="hs-controls-row hs-controls-row-label">
          <input
            disabled={disabled}
            onChange={(event) => onLabelChange(event.target.value)}
            type="text"
            value={labelDraft}
          />
          <button disabled={disabled} onClick={onRelabel} type="button">
            Rename moment
          </button>
        </div>
      ) : null}
    </section>
  );
}
