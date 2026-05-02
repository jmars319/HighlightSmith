type TranscriptSnippetBlockProps = {
  heading: string;
  text: string;
};

export function TranscriptSnippetBlock({
  heading,
  text,
}: TranscriptSnippetBlockProps) {
  return (
    <section className="vcp-block">
      <span className="vcp-block-label">{heading}</span>
      <blockquote>{text}</blockquote>
    </section>
  );
}
