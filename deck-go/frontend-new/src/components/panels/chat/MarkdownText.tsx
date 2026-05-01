import { MarkdownRenderer } from "./shared-renderer/MarkdownViewer";

export function MarkdownText({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <MarkdownRenderer
      className="deck-ui-markdown"
      content={text}
      mode={streaming ? "streaming" : "static"}
    />
  );
}
