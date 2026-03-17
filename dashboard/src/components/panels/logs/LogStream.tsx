"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useLogsStore, type LogLevel } from "@/stores/logs";

// ---------------------------------------------------------------------------
// Level badge colors (CSS variable-friendly)
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<LogLevel, { bg: string; text: string }> = {
  debug: { bg: "var(--bg-tertiary, #374151)", text: "var(--text-secondary, #9ca3af)" },
  info: { bg: "var(--accent-muted, #1e3a5f)", text: "var(--accent, #3b82f6)" },
  warn: { bg: "rgba(234, 179, 8, 0.15)", text: "#eab308" },
  error: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" },
};

/**
 * LogStream — auto-scrolling monospace log output with color-coded level badges.
 */
export function LogStream() {
  const t = useTranslations("logs");
  const entries = useLogsStore((s) => s.entries);
  const streaming = useLogsStore((s) => s.streaming);
  const containerRef = useRef<HTMLDivElement>(null);

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
        style={{ color: "var(--text-secondary)" }}
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
        backgroundColor: "var(--bg-primary)",
      }}
    >
      {entries.map((entry, idx) => {
        const colors = LEVEL_COLORS[entry.level];
        return (
          <div
            key={idx}
            className="flex items-start gap-2 py-0.5"
            style={{ color: "var(--text-primary)" }}
          >
            {/* Timestamp */}
            <span className="shrink-0" style={{ color: "var(--text-secondary)", minWidth: 180 }}>
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
                color: "var(--text-secondary)",
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
