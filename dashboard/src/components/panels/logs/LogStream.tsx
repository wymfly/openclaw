"use client";

import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLogsStore, type LogLevel } from "@/stores/logs";

const LEVEL_BADGE_STYLES: Record<LogLevel, string> = {
  debug: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
  info: "bg-[var(--accent-muted)] text-[var(--accent)]",
  warn: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]",
  error: "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]",
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
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[var(--text-secondary)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
          <FileText size={20} className="text-[var(--accent)]" />
        </div>
        <p className="text-sm">{t("noLogs")}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
    >
      {entries.map((entry, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2 py-1 hover:bg-[var(--bg-tertiary)] rounded px-1 transition-colors duration-100"
        >
          {/* Timestamp */}
          <span className="shrink-0 text-[var(--text-secondary)] min-w-[180px]">
            {entry.timestamp}
          </span>

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
          <span className="shrink-0 text-[var(--accent)] min-w-[64px]">[{entry.source}]</span>

          {/* Message */}
          <span className="break-all text-[var(--text-primary)]">{entry.message}</span>
        </div>
      ))}
    </div>
  );
}
