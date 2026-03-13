type ReviewControlsProps = {
  labelDraft: string;
  onLabelChange: (value: string) => void;
  onAccept?: () => void;
  onReject?: () => void;
  onRetime?: () => void;
  onRelabel?: () => void;
};

export function ReviewControls({
  labelDraft,
  onLabelChange,
  onAccept,
  onReject,
  onRetime,
  onRelabel,
}: ReviewControlsProps) {
  return (
    <section className="hs-block">
      <span className="hs-block-label">Review controls</span>
      <div className="hs-controls-row">
        <button onClick={onAccept} type="button">
          Accept
        </button>
        <button onClick={onReject} type="button">
          Reject
        </button>
        <button onClick={onRetime} type="button">
          Adjust
        </button>
      </div>
      <div className="hs-controls-row">
        <input
          onChange={(event) => onLabelChange(event.target.value)}
          type="text"
          value={labelDraft}
        />
        <button onClick={onRelabel} type="button">
          Save label
        </button>
      </div>
    </section>
  );
}
