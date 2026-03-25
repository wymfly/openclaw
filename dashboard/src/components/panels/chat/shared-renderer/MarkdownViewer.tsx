"use client";
import { Streamdown } from "streamdown";

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="p-4">
      <div className="chat-prose max-w-none text-sm" style={{ color: "var(--foreground)" }}>
        <Streamdown mode="static">{content}</Streamdown>
      </div>
    </div>
  );
}
