import { buildCandidateTranscriptContext } from "@vaexcore/pulse-domain";
import type {
  CandidateWindow,
  TranscriptChunk,
} from "@vaexcore/pulse-shared-types";
import { formatLongTime, percentage } from "../lib/format";

type TranscriptContextPeekProps = {
  candidate: CandidateWindow | null;
  transcript: TranscriptChunk[];
};

export function TranscriptContextPeek({
  candidate,
  transcript,
}: TranscriptContextPeekProps) {
  if (!candidate) {
    return (
      <section className="context-panel utility-block">
        <div className="section-title-row">
          <div>
            <h3>Transcript context</h3>
            <p className="context-summary-copy">
              Select a moment to inspect setup, payoff, and aftermath.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const context = buildCandidateTranscriptContext(transcript, candidate);
  const totalContextChunks =
    context.before.length + context.inside.length + context.after.length;
  const sections: Array<{
    id: "before" | "inside" | "after";
    label: string;
    emptyCopy: string;
    chunks: TranscriptChunk[];
  }> = [
    {
      id: "before",
      label: "Before window",
      emptyCopy: "No nearby setup chunk landed before this window.",
      chunks: context.before,
    },
    {
      id: "inside",
      label: "Inside moment",
      emptyCopy: "No transcript chunk overlaps this moment.",
      chunks: context.inside,
    },
    {
      id: "after",
      label: "After window",
      emptyCopy: "No nearby aftermath chunk landed after this window.",
      chunks: context.after,
    },
  ];

  return (
    <section className="context-panel utility-block">
      <div className="section-title-row">
        <div>
          <h3>Transcript context</h3>
          <p className="context-summary-copy">
            Closest transcript chunks around the selected moment. This is for
            review context only.
          </p>
        </div>
        <span className="queue-count">{totalContextChunks} chunks</span>
      </div>

      <div className="context-peek-grid">
        {sections.map((section) => (
          <article
            className={`context-peek-column ${section.id}`}
            key={section.id}
          >
            <div className="context-peek-header">
              <span className="detail-label">{section.label}</span>
              <span className="queue-count">{section.chunks.length}</span>
            </div>

            {section.chunks.length > 0 ? (
              <div className="context-peek-list">
                {section.chunks.map((chunk) => (
                  <article
                    className={`context-chunk ${section.id}`}
                    key={chunk.id}
                  >
                    <div className="context-chunk-top">
                      <span>
                        {formatLongTime(chunk.startSeconds)} to{" "}
                        {formatLongTime(chunk.endSeconds)}
                      </span>
                      {chunk.confidence !== undefined &&
                      chunk.confidence > 0.05 ? (
                        <span>{percentage(chunk.confidence)}</span>
                      ) : null}
                    </div>
                    <p>{chunk.text}</p>
                  </article>
                ))}
              </div>
            ) : section.id === "inside" && candidate.transcriptSnippet ? (
              <article className="context-chunk fallback">
                <div className="context-chunk-top">
                  <span>Saved moment snippet</span>
                </div>
                <p>{candidate.transcriptSnippet}</p>
                <small>
                  No stored transcript chunk overlaps this moment, so VCP is
                  showing the snippet it saved during analysis instead.
                </small>
              </article>
            ) : (
              <p className="context-empty-copy">{section.emptyCopy}</p>
            )}
          </article>
        ))}
      </div>

      {totalContextChunks === 0 && transcript.length === 0 ? (
        <p className="context-summary-copy">
          No transcript chunks were saved for this session, so context review is
          limited to the snippet VCP saved during analysis.
        </p>
      ) : null}
    </section>
  );
}
