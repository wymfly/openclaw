"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Fixed row height for virtualization (12px font × 1.6 line-height + 4px padding). */
const ROW_HEIGHT = 24;

/** Extra rows rendered above/below the visible area. */
const OVERSCAN = 20;

/** Threshold in px: if user is within this distance from bottom, auto-scroll. */
const NEAR_BOTTOM_PX = 40;

/**
 * LogStream — virtualized monospace log output with color-coded level badges.
 *
 * Only visible rows (+ overscan) are rendered in the DOM, keeping
 * performance stable even with the full 5 000-entry ring buffer.
 */
export function LogStream() {
  const t = useTranslations("logs");
  const allEntries = useLogsStore((s) => s.entries);
  const filters = useLogsStore((s) => s.filters);
  const streaming = useLogsStore((s) => s.streaming);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const isNearBottomRef = useRef(true);

  // Render-time filtering — ring buffer retains ALL entries.
  const entries = useMemo(() => {
    return allEntries.filter((entry) => {
      if (
        filters.levels.length > 0 &&
        filters.levels.length < 4 &&
        !filters.levels.includes(entry.level)
      ) {
        return false;
      }
      if (filters.source !== "all" && entry.source !== filters.source) {
        return false;
      }
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

  // Virtual window calculation.
  const totalHeight = entries.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(
    entries.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN,
  );
  const visibleEntries = entries.slice(startIdx, endIdx);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    setScrollTop(el.scrollTop);
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }, []);

  // Track container size via ResizeObserver.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((observed) => {
      for (const entry of observed) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    setContainerHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll to bottom when streaming and near bottom.
  useEffect(() => {
    if (!streaming || !isNearBottomRef.current) {
      return;
    }
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries.length, streaming]);

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
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
        fontSize: 12,
        lineHeight: "1.6",
        backgroundColor: "var(--background)",
      }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleEntries.map((entry, i) => {
          const idx = startIdx + i;
          const colors = LEVEL_COLORS[entry.level];
          return (
            <div
              key={idx}
              className="flex items-center gap-2"
              style={{
                position: "absolute",
                top: idx * ROW_HEIGHT,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
                paddingLeft: 12,
                paddingRight: 12,
                color: "var(--foreground)",
              }}
            >
              {/* Timestamp */}
              <span
                className="shrink-0"
                style={{ color: "var(--muted-foreground)", minWidth: 180 }}
              >
                {entry.timestamp}
              </span>

              {/* Level badge */}
              <span
                className="shrink-0 rounded px-1.5 text-center uppercase"
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
              <span className="shrink-0" style={{ color: "var(--muted-foreground)", minWidth: 64 }}>
                [{entry.source}]
              </span>

              {/* Message (truncated to single line, full text on hover) */}
              <span className="truncate min-w-0" title={entry.message}>
                {entry.message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
