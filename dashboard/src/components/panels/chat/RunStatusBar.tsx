"use client";

import { Clock, Cpu, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatDuration, formatTokenCount } from "@/lib/format-utils";
import type { RunMetadata } from "@/stores/chat-types";

/* ------------------------------------------------------------------ */
/*  RunStatusBar — compact metadata bar below assistant messages       */
/* ------------------------------------------------------------------ */

export function RunStatusBar({ metadata }: { metadata: RunMetadata }) {
  const t = useTranslations("chat");
  const [elapsed, setElapsed] = useState<number | undefined>(metadata.durationMs);

  // Live elapsed timer while streaming
  useEffect(() => {
    if (!metadata.streaming || !metadata.startedAt) {
      setElapsed(metadata.durationMs);
      return;
    }

    // Compute initial elapsed immediately
    setElapsed(Date.now() - metadata.startedAt);

    const id = setInterval(() => {
      setElapsed(Date.now() - metadata.startedAt!);
    }, 1000);

    return () => clearInterval(id);
  }, [metadata.streaming, metadata.startedAt, metadata.durationMs]);

  return (
    <div className="flex items-center gap-3 mt-1 px-1 text-[10px] font-mono text-[var(--text-secondary)]">
      {/* Model badge */}
      {metadata.model && (
        <span className="flex items-center gap-1">
          <Cpu size={10} className="text-[var(--text-secondary)]" />
          <span className="text-[var(--accent)]">{metadata.model}</span>
        </span>
      )}

      {/* Token summary */}
      <span className="flex items-center gap-1">
        <Zap size={10} className="text-[var(--text-secondary)]" />
        <span>
          {t("runTokensIn")} {formatTokenCount(metadata.usage?.input)}
          {" / "}
          {t("runTokensOut")} {formatTokenCount(metadata.usage?.output)}
          {metadata.usage?.cache !== undefined && (
            <>
              {" / "}
              {t("runTokensCache")} {formatTokenCount(metadata.usage.cache)}
            </>
          )}
        </span>
      </span>

      {/* Duration */}
      <span className="flex items-center gap-1">
        <Clock size={10} className="text-[var(--text-secondary)]" />
        {metadata.streaming ? (
          <span className="text-[var(--warning)]">
            {t("runStreaming")} {formatDuration(elapsed)}
          </span>
        ) : (
          <span>
            {t("runDuration")} {formatDuration(elapsed)}
          </span>
        )}
      </span>
    </div>
  );
}
