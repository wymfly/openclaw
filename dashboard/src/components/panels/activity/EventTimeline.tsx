"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useActivityStore, type ActivityEventType } from "@/stores/activity";

// ---------------------------------------------------------------------------
// Type icon colors
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<ActivityEventType, { bg: string; text: string }> = {
  tool_call: {
    bg: "var(--purple-muted)",
    text: "var(--purple)",
  },
  chat: {
    bg: "var(--accent-muted)",
    text: "var(--accent)",
  },
  status: {
    bg: "var(--warning-muted)",
    text: "var(--warning)",
  },
  agent: {
    bg: "var(--success-muted)",
    text: "var(--success)",
  },
  system: {
    bg: "var(--bg-tertiary)",
    text: "var(--text-secondary)",
  },
};

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function relativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  if (delta < 0) {
    return "now";
  }
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// EventTimeline
// ---------------------------------------------------------------------------

/**
 * Reverse-chronological list of activity events.
 * Each entry shows: relative timestamp, type icon, agent name, and description.
 */
export function EventTimeline() {
  const t = useTranslations("activity");
  const events = useActivityStore((s) => s.events);
  const filters = useActivityStore((s) => s.filters);

  // Apply client-side filters.
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filters.agentId && e.agentId !== filters.agentId) {
        return false;
      }
      if (filters.eventType && e.type !== filters.eventType) {
        return false;
      }
      return true;
    });
  }, [events, filters]);

  if (filtered.length === 0) {
    return (
      <div
        className="flex items-center justify-center flex-1"
        style={{ color: "var(--text-secondary)" }}
      >
        <p className="text-sm">{t("noEvents")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3" style={{ backgroundColor: "var(--bg-primary)" }}>
      {filtered.map((event) => {
        const typeColors = TYPE_COLORS[event.type] ?? TYPE_COLORS.system;
        return (
          <div
            key={event.id}
            className="flex items-start gap-3 py-2 border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            {/* Timestamp */}
            <span
              className="text-xs shrink-0 pt-0.5"
              style={{
                color: "var(--text-secondary)",
                minWidth: 60,
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
              }}
            >
              {relativeTime(event.timestamp)}
            </span>

            {/* Type badge */}
            <span
              className="text-xs px-1.5 py-0.5 rounded shrink-0 font-medium"
              style={{
                backgroundColor: typeColors.bg,
                color: typeColors.text,
                fontSize: 10,
                minWidth: 60,
                textAlign: "center",
              }}
            >
              {event.type}
            </span>

            {/* Agent name */}
            {(event.agentName ?? event.agentId) && (
              <span
                className="text-xs shrink-0 font-medium pt-0.5"
                style={{ color: "var(--accent)", minWidth: 60 }}
              >
                {event.agentName ?? event.agentId}
              </span>
            )}

            {/* Description + details */}
            <div className="flex-1 min-w-0">
              <p className="text-xs break-words" style={{ color: "var(--text-primary)" }}>
                {event.description}
              </p>
              {event.details && (
                <p
                  className="text-xs mt-0.5 break-words"
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
                    maxHeight: 60,
                    overflow: "hidden",
                  }}
                >
                  {event.details}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
