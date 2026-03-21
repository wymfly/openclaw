"use client";

interface CodeViewerProps {
  content: string;
  language?: string;
}

export function CodeViewer({ content, language }: CodeViewerProps) {
  const lines = content.split("\n");

  return (
    <div className="flex-1 overflow-auto bg-[var(--bg-primary)]">
      <pre className="text-xs font-mono leading-relaxed">
        <code data-lang={language || undefined}>
          {lines.map((line, i) => (
            <div key={i} className="flex hover:bg-[var(--bg-tertiary)]/50 transition-colors">
              <span className="inline-block w-10 shrink-0 text-right pr-3 select-none text-[var(--text-secondary)]/50">
                {i + 1}
              </span>
              <span className="text-[var(--text-primary)] whitespace-pre-wrap break-all flex-1">
                {line}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
