type ReviewControlsProps = {
  labelDraft: string;
  onLabelChange: (value: string) => void;
  onAccept?: () => void;
  onReject?: () => void;
  onRetime?: () => void;
  onRelabel?: () => void;
  disabled?: boolean;
};

export function ReviewControls({
  labelDraft,
  onLabelChange,
  onAccept,
  onReject,
  onRetime,
  onRelabel,
  disabled = false,
}: ReviewControlsProps) {
  return (
    <section className="hs-block">
      <span className="hs-block-label">Review controls</span>
      <div className="hs-controls-row hs-controls-row-actions">
        <button disabled={disabled} onClick={onAccept} type="button">
          Accept
        </button>
        <button disabled={disabled} onClick={onReject} type="button">
          Reject
        </button>
        <button disabled={disabled} onClick={onRetime} type="button">
          Adjust
        </button>
      </div>
      <div className="hs-controls-row hs-controls-row-label">
        <input
          disabled={disabled}
          onChange={(event) => onLabelChange(event.target.value)}
          type="text"
          value={labelDraft}
        />
        <button disabled={disabled} onClick={onRelabel} type="button">
          Save label
        </button>
      </div>
    </section>
  );
}
