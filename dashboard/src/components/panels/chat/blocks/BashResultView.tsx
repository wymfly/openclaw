"use client";

import { Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BashParsedResult } from "@/lib/tool-result-parser";

// ---------------------------------------------------------------------------
// BashResultView — structured split view for parsed bash tool output.
//
// Renders: command header bar, stdout monospace block, stderr red-tinted block
// (only when non-empty), and an exit code badge (green=0, red=non-zero).
// ---------------------------------------------------------------------------

interface BashResultViewProps {
  result: BashParsedResult;
}

export function BashResultView({ result }: BashResultViewProps) {
  const t = useTranslations("chat");
  const isSuccess = result.exitCode === 0;

  return (
    <div className="my-1.5 text-xs rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      {/* Command header bar */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--muted)] text-[var(--muted-foreground)] border-b border-[var(--border-subtle)]">
        <Terminal size={12} className="shrink-0" />
        <span className="font-medium">{t("bashCommand")}:</span>
        <code className="font-mono text-[var(--primary)] truncate">$ {result.command}</code>
        {/* Exit code badge */}
        <span
          className={`ml-auto shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            isSuccess
              ? "bg-[var(--success-muted)] text-[var(--success-muted-text)]"
              : "bg-[var(--destructive-muted)] text-[var(--destructive-muted-text)]"
          }`}
        >
          {t("bashExitCode")}: {result.exitCode}
        </span>
      </div>

      {/* stdout block */}
      {result.stdout && (
        <div className="px-2.5 py-2">
          <div className="text-[10px] font-medium text-[var(--text-tertiary)] mb-1 uppercase tracking-wide">
            {t("bashStdout")}
          </div>
          <pre className="text-xs whitespace-pre-wrap overflow-auto font-mono text-[var(--foreground)] max-h-[300px]">
            {result.stdout}
          </pre>
        </div>
      )}

      {/* stderr block — only shown when non-empty */}
      {result.stderr && (
        <div className="px-2.5 py-2 bg-[var(--destructive-muted)] border-t border-[var(--border-subtle)]">
          <div className="text-[10px] font-medium text-[var(--destructive-muted-text)] mb-1 uppercase tracking-wide">
            {t("bashStderr")}
          </div>
          <pre className="text-xs whitespace-pre-wrap overflow-auto font-mono text-[var(--destructive-muted-text)] max-h-[200px]">
            {result.stderr}
          </pre>
        </div>
      )}
    </div>
  );
}
