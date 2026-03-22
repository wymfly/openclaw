"use client";

import { Copy, Check, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatParamSummary } from "@/lib/format-utils";
import { ToolParamView } from "./ToolParamView";

// ---------------------------------------------------------------------------
// ToolUseCard — structured tool call display with collapse, copy, and
// parameter summary.
// ---------------------------------------------------------------------------

interface ToolUseCardProps {
  name: string;
  input: Record<string, unknown>;
  /** When true the card starts open (e.g. while streaming). */
  defaultOpen?: boolean;
}

export function ToolUseCard({ name, input, defaultOpen }: ToolUseCardProps) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);

  const summary = formatParamSummary(input);

  const handleCopy = () => {
    void navigator.clipboard.writeText(JSON.stringify(input, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <details
      open={defaultOpen}
      className="my-1.5 text-xs rounded-lg border border-[var(--border-subtle)] overflow-hidden"
    >
      <summary className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
        <Wrench size={12} className="shrink-0" />
        <span className="font-medium">{t("toolCall")}:</span>
        <code className="font-mono text-[var(--accent)]">{name}</code>
        {summary && <span className="text-[var(--text-tertiary)] truncate ml-1">({summary})</span>}
      </summary>

      <div className="px-2.5 pb-2.5 border-t border-[var(--border-subtle)]">
        {/* Copy JSON button — outside <summary> to avoid nested interactive */}
        <div className="flex justify-end pt-1.5 pb-1">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            {copied ? (
              <>
                <Check size={10} className="text-[var(--success)]" />
                {t("copied")}
              </>
            ) : (
              <>
                <Copy size={10} />
                {t("copyJson")}
              </>
            )}
          </button>
        </div>

        <ToolParamView input={input} />
      </div>
    </details>
  );
}
