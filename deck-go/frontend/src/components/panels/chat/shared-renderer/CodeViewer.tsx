import { HighlightedCodeView } from "../blocks/HighlightedCodeView";

export function CodeViewer({ content, language }: { content: string; language?: string }) {
  return <HighlightedCodeView content={content} extension={language} />;
}
