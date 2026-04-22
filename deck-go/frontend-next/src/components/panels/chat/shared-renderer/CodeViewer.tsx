"use client";

import { Streamdown } from "streamdown";

interface CodeViewerProps {
  content: string;
  language?: string;
}

export function CodeViewer({ content, language }: CodeViewerProps) {
  // Wrap content in a fenced code block so Streamdown renders it with syntax highlighting
  const wrapped = `\`\`\`${language ?? ""}\n${content}\n\`\`\``;

  return (
    <div className="flex-1 overflow-auto bg-[var(--background)] p-2">
      <div className="chat-prose max-w-none text-sm">
        <Streamdown mode="static" lineNumbers>
          {wrapped}
        </Streamdown>
      </div>
    </div>
  );
}
