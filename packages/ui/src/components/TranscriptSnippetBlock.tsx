type TranscriptSnippetBlockProps = {
  heading: string;
  text: string;
};

export function TranscriptSnippetBlock({
  heading,
  text,
}: TranscriptSnippetBlockProps) {
  return (
    <section className="hs-block">
      <span className="hs-block-label">{heading}</span>
      <blockquote>{text}</blockquote>
    </section>
  );
}
