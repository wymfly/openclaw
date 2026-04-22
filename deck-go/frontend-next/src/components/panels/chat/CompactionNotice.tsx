"use client";

/**
 * System notification card for context compaction events.
 * Inserted into the message flow when compaction is detected.
 */

import { Minimize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatTokenCount } from "@/lib/format-utils";

interface CompactionNoticeProps {
  tokensBefore?: number;
  tokensAfter?: number;
  timestamp: number;
}

export function CompactionNotice({ tokensBefore, tokensAfter, timestamp }: CompactionNoticeProps) {
  const t = useTranslations("chat");

  return (
    <div className="flex items-center gap-2 mx-auto my-2 px-3 py-1.5 rounded-full text-[11px] bg-[var(--warning-muted)] text-[var(--warning-muted-text)] max-w-fit">
      <Minimize2 size={12} className="shrink-0" />
      <span>{t("compacted")}</span>
      {tokensBefore != null && tokensAfter != null && (
        <span className="text-[var(--muted-foreground)]">
          {formatTokenCount(tokensBefore)} → {formatTokenCount(tokensAfter)}
        </span>
      )}
      <span className="text-[var(--text-tertiary)]">
        {new Date(timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
