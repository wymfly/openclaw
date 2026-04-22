"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// HighlightedCodeView — line-numbered code view with language label and copy.
// ---------------------------------------------------------------------------

interface HighlightedCodeViewProps {
  content: string;
  /** File extension or language (e.g. "ts", "py", "typescript"). */
  extension?: string;
}

export function HighlightedCodeView({ content, extension }: HighlightedCodeViewProps) {
  const t = useTranslations("chat");
  const lines = useMemo(() => content.split("\n"), [content]);
  const [copied, setCopied] = useState(false);

  // Width of line number gutter — adapts to digit count
  const gutterWidth = String(lines.length).length;
  const language = extension?.toLowerCase() || "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-1.5 rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      {/* Toolbar: language label + copy button */}
      <div
        className="flex items-center justify-between px-3 py-1 text-[11px]"
        style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <span style={{ color: "var(--muted-foreground)" }}>{language || "text"}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1 transition-colors"
          style={{ color: "var(--muted-foreground)" }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? t("copied") : t("copy")}</span>
        </button>
      </div>
      <div className="max-h-[400px] overflow-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="leading-5 hover:bg-[var(--muted)] transition-colors">
                {/* Line number */}
                <td
                  className="px-2 text-right select-none text-[var(--text-tertiary)] border-r border-[var(--border-subtle)] align-top whitespace-nowrap bg-[var(--card)]"
                  style={{ minWidth: `${gutterWidth + 2}ch` }}
                >
                  {i + 1}
                </td>
                {/* Code content */}
                <td className="px-3 text-[var(--foreground)] whitespace-pre-wrap break-all">
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
