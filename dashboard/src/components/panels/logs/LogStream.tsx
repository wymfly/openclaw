"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { useLogsStore, type LogLevel } from "@/stores/logs";

// ---------------------------------------------------------------------------
// Level badge colors (CSS variable-friendly)
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<LogLevel, { bg: string; text: string }> = {
  debug: { bg: "var(--muted)", text: "var(--muted-foreground)" },
  info: { bg: "var(--primary-muted)", text: "var(--primary)" },
  warn: { bg: "var(--warning-muted)", text: "var(--warning)" },
  error: { bg: "var(--destructive-muted)", text: "var(--destructive)" },
};

/**
 * LogStream — auto-scrolling monospace log output with color-coded level badges.
 */
export function LogStream() {
  const t = useTranslations("logs");
  const allEntries = useLogsStore((s) => s.entries);
  const filters = useLogsStore((s) => s.filters);
  const streaming = useLogsStore((s) => s.streaming);
  const containerRef = useRef<HTMLDivElement>(null);

  // Render-time filtering — ring buffer retains ALL entries
  const entries = useMemo(() => {
    return allEntries.filter((entry) => {
      // Level filter
      if (
        filters.levels.length > 0 &&
        filters.levels.length < 4 &&
        !filters.levels.includes(entry.level)
      ) {
        return false;
      }
      // Source filter
      if (filters.source !== "all" && entry.source !== filters.source) {
        return false;
      }
      // Session filter
      if (
        filters.sessionKey &&
        entry.sessionKey !== filters.sessionKey &&
        !entry.message.includes(filters.sessionKey)
      ) {
        return false;
      }
      return true;
    });
  }, [allEntries, filters]);

  // Auto-scroll to bottom when new entries arrive, unless paused.
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
      <div
        className="flex items-center justify-center flex-1"
        style={{ color: "var(--muted-foreground)" }}
      >
        <p className="text-sm">{t("noLogs")}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-3"
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
        fontSize: 12,
        lineHeight: "1.6",
        backgroundColor: "var(--background)",
      }}
    >
      {entries.map((entry, idx) => {
        const colors = LEVEL_COLORS[entry.level];
        return (
          <div
            key={idx}
            className="flex items-start gap-2 py-0.5"
            style={{ color: "var(--foreground)" }}
          >
            {/* Timestamp */}
            <span className="shrink-0" style={{ color: "var(--muted-foreground)", minWidth: 180 }}>
              {entry.timestamp}
            </span>

            {/* Level badge */}
            <span
              className="shrink-0 rounded px-1.5 py-0 text-center uppercase"
              style={{
                backgroundColor: colors.bg,
                color: colors.text,
                fontSize: 10,
                fontWeight: 600,
                minWidth: 48,
                lineHeight: "18px",
              }}
            >
              {entry.level}
            </span>

            {/* Source */}
            <span
              className="shrink-0"
              style={{
                color: "var(--muted-foreground)",
                minWidth: 64,
              }}
            >
              [{entry.source}]
            </span>

            {/* Message */}
            <span className="break-all">{entry.message}</span>
          </div>
        );
      })}
    </div>
  );
}
