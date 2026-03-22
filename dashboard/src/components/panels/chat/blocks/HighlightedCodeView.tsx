"use client";

import { useMemo } from "react";

// ---------------------------------------------------------------------------
// HighlightedCodeView — simple line-numbered code view for `read` results.
//
// v1: monospace rendering with line numbers, no syntax highlighting.
// The `extension` prop is accepted and stored for future highlighting.
// ---------------------------------------------------------------------------

interface HighlightedCodeViewProps {
  content: string;
  /** File extension (e.g. "ts", "py") — reserved for future syntax highlighting. */
  extension?: string;
}

export function HighlightedCodeView({ content, extension: _extension }: HighlightedCodeViewProps) {
  const lines = useMemo(() => content.split("\n"), [content]);

  // Width of line number gutter — adapts to digit count
  const gutterWidth = String(lines.length).length;

  return (
    <div className="my-1.5 rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      <div className="max-h-[400px] overflow-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="leading-5 hover:bg-[var(--bg-tertiary)] transition-colors">
                {/* Line number */}
                <td
                  className="px-2 text-right select-none text-[var(--text-tertiary)] border-r border-[var(--border-subtle)] align-top whitespace-nowrap bg-[var(--bg-secondary)]"
                  style={{ minWidth: `${gutterWidth + 2}ch` }}
                >
                  {i + 1}
                </td>
                {/* Code content */}
                <td className="px-3 text-[var(--text-primary)] whitespace-pre-wrap break-all">
                  {line || "\u00A0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
