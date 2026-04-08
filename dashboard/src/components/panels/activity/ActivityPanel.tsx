"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import {
  useActivityStore,
  type ActivityEventType,
  type ActivityTimeRange,
} from "@/stores/activity";
import { EventTimeline } from "./EventTimeline";
import { useActivitySSE } from "./useActivitySSE";

const EVENT_TYPES: (ActivityEventType | "all")[] = [
  "all",
  "tool_call",
  "chat",
  "status",
  "agent",
  "system",
];

const EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
  all: "allTypes",
  tool_call: "toolCall",
  chat: "chatMessage",
  status: "statusChange",
  agent: "agent",
  system: "system",
};

const TIME_RANGES: ActivityTimeRange[] = ["1h", "6h", "24h", "7d", "all"];

const TIME_RANGE_LABEL_KEYS: Record<ActivityTimeRange, string> = {
  "1h": "lastHour",
  "6h": "last6Hours",
  "24h": "last24Hours",
  "7d": "last7Days",
  all: "allTime",
};

/**
 * Activity Feed panel — filter dropdowns at top, event timeline below.
 */
export function ActivityPanel() {
  const t = useTranslations("activity");
  const { filters, setAgentFilter, setTypeFilter, setTimeRange, fetchRecent } = useActivityStore();

  // Connect to SSE for real-time activity events.
  useActivitySSE();

  // Fetch recent events on mount.
  useEffect(() => {
    void fetchRecent();
  }, [fetchRecent]);

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-wrap"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <h2 className="text-sm font-semibold shrink-0" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h2>

        {/* Time range filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
            {t("timeRange")}:
          </span>
          <select
            value={filters.timeRange}
            onChange={(e) => setTimeRange(e.target.value as ActivityTimeRange)}
            className="text-xs rounded px-2 py-1 border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          >
            {TIME_RANGES.map((range) => (
              <option key={range} value={range}>
                {t(TIME_RANGE_LABEL_KEYS[range])}
              </option>
            ))}
          </select>
        </div>

        {/* Agent filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
            {t("agent")}:
          </span>
          <input
            type="text"
            value={filters.agentId ?? ""}
            onChange={(e) => setAgentFilter(e.target.value || null)}
            placeholder={t("allAgents")}
            className="text-xs rounded px-2 py-1 border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              width: 140,
            }}
          />
        </div>

        {/* Event type filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
            {t("type")}:
          </span>
          <select
            value={filters.eventType ?? "all"}
            onChange={(e) => {
              const val = e.target.value;
              setTypeFilter(val === "all" ? null : (val as ActivityEventType));
            }}
            className="text-xs rounded px-2 py-1 border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(EVENT_TYPE_LABEL_KEYS[type] ?? type)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Event timeline */}
      <EventTimeline />
    </div>
  );
}
