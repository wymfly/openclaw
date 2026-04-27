import { MarkdownText } from "../MarkdownText";

export function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="deck-ui-artifact-markdown">
      <MarkdownText text={content} />
    </div>
  );
}
