"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLogsStore, type LogLevel } from "@/stores/logs";

const LEVEL_BADGE_STYLES: Record<LogLevel, string> = {
  debug: "bg-muted text-muted-foreground",
  info: "bg-[var(--accent-muted)] text-[var(--accent)]",
  warn: "bg-[var(--warning-muted)] text-[var(--warning)]",
  error: "bg-[var(--danger-muted)] text-[var(--danger)]",
};

export function LogStream() {
  const t = useTranslations("logs");
  const entries = useLogsStore((s) => s.entries);
  const streaming = useLogsStore((s) => s.streaming);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streaming) {
      return;
    }
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries, streaming]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-muted-foreground">
        <p className="text-sm">{t("noLogs")}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-3 bg-background font-mono text-xs leading-relaxed"
    >
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-start gap-2 py-0.5 text-foreground">
          {/* Timestamp */}
          <span className="shrink-0 text-muted-foreground min-w-[180px]">{entry.timestamp}</span>

          {/* Level badge */}
          <Badge
            className={cn(
              "shrink-0 uppercase text-center text-[10px] font-semibold h-[18px] min-w-[48px]",
              LEVEL_BADGE_STYLES[entry.level],
            )}
          >
            {entry.level}
          </Badge>

          {/* Source */}
          <span className="shrink-0 text-muted-foreground min-w-[64px]">[{entry.source}]</span>

          {/* Message */}
          <span className="break-all">{entry.message}</span>
        </div>
      ))}
    </div>
  );
}
