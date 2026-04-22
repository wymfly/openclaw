"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  useActivityStore,
  type ActivityEvent,
  type ActivityEventType,
  type ActivityTimeRange,
} from "@/stores/activity";

// ---------------------------------------------------------------------------
// Type icon colors
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<ActivityEventType, { bg: string; text: string }> = {
  tool_call: { bg: "var(--purple-muted)", text: "var(--purple)" },
  chat: { bg: "var(--primary-muted)", text: "var(--primary)" },
  status: { bg: "var(--warning-muted)", text: "var(--warning)" },
  agent: { bg: "var(--success-muted)", text: "var(--success)" },
  system: { bg: "var(--muted)", text: "var(--muted-foreground)" },
};

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

const TIME_RANGE_MS: Record<ActivityTimeRange, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

function relativeTime(timestamp: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { style: "narrow", numeric: "always" });
  const deltaSec = Math.round((timestamp - Date.now()) / 1000);

  if (deltaSec >= 0) {
    return rtf.format(0, "second");
  }

  const absSec = Math.abs(deltaSec);
  if (absSec < 60) {
    return rtf.format(deltaSec, "second");
  }
  if (absSec < 3600) {
    return rtf.format(-Math.round(absSec / 60), "minute");
  }
  if (absSec < 86400) {
    return rtf.format(-Math.round(absSec / 3600), "hour");
  }
  return rtf.format(-Math.round(absSec / 86400), "day");
}

type TimeGroup = "today" | "yesterday" | "thisWeek" | "older";

function getTimeGroup(timestamp: number): TimeGroup {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  // ISO week: Monday=1 … Sunday=7 (avoids getDay()=0 Sunday edge case)
  const isoDay = now.getDay() === 0 ? 7 : now.getDay();
  const weekStart = todayStart - (isoDay - 1) * 24 * 60 * 60 * 1000;

  if (timestamp >= todayStart) {
    return "today";
  }
  if (timestamp >= yesterdayStart) {
    return "yesterday";
  }
  if (timestamp >= weekStart) {
    return "thisWeek";
  }
  return "older";
}

const GROUP_ORDER: TimeGroup[] = ["today", "yesterday", "thisWeek", "older"];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GroupHeader({
  groupKey,
  count,
  expanded,
  onToggle,
}: {
  groupKey: TimeGroup;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("activity");
  const Icon = expanded ? ChevronDown : ChevronRight;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold cursor-pointer"
      style={{
        color: "var(--muted-foreground)",
        backgroundColor: "var(--muted)",
      }}
    >
      <Icon size={14} />
      <span>{t(groupKey)}</span>
      <span
        className="text-[10px] px-1.5 rounded-full font-medium"
        style={{
          backgroundColor: "var(--background)",
          color: "var(--muted-foreground)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  const locale = useLocale();
  const typeColors = TYPE_COLORS[event.type] ?? TYPE_COLORS.system;
  return (
    <div
      className="flex items-start gap-3 py-2 px-3 border-b last:border-b-0"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Timestamp */}
      <span
        className="text-xs shrink-0 pt-0.5"
        style={{
          color: "var(--muted-foreground)",
          minWidth: 60,
          fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
        }}
      >
        {relativeTime(event.timestamp, locale)}
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
          style={{ color: "var(--primary)", minWidth: 60 }}
        >
          {event.agentName ?? event.agentId}
        </span>
      )}

      {/* Description + details */}
      <div className="flex-1 min-w-0">
        <p className="text-xs break-words" style={{ color: "var(--foreground)" }}>
          {event.description}
        </p>
        {event.details && (
          <p
            className="text-xs mt-0.5 break-words"
            style={{
              color: "var(--muted-foreground)",
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
}

// ---------------------------------------------------------------------------
// EventTimeline
// ---------------------------------------------------------------------------

/**
 * Reverse-chronological list of activity events, grouped by time bucket.
 * Each group has a collapsible header showing the label and event count.
 */
export function EventTimeline() {
  const t = useTranslations("activity");
  const events = useActivityStore((s) => s.events);
  const filters = useActivityStore((s) => s.filters);
  const [collapsed, setCollapsed] = useState(new Set());

  // Apply client-side filters (agent, type, time range).
  const filtered = useMemo(() => {
    const now = Date.now();
    const rangeMs = TIME_RANGE_MS[filters.timeRange];
    const cutoff = rangeMs === Infinity ? 0 : now - rangeMs;

    return events.filter((e) => {
      if (filters.agentId && e.agentId !== filters.agentId) {
        return false;
      }
      if (filters.eventType && e.type !== filters.eventType) {
        return false;
      }
      if (e.timestamp < cutoff) {
        return false;
      }
      return true;
    });
  }, [events, filters]);

  // Group by time bucket.
  const groups = useMemo(() => {
    const map = new Map<TimeGroup, ActivityEvent[]>();
    for (const event of filtered) {
      const group = getTimeGroup(event.timestamp);
      const list = map.get(group);
      if (list) {
        list.push(event);
      } else {
        map.set(group, [event]);
      }
    }
    return map;
  }, [filtered]);

  const toggleGroup = (group: TimeGroup) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  if (filtered.length === 0) {
    return (
      <div
        className="flex items-center justify-center flex-1"
        style={{ color: "var(--muted-foreground)" }}
      >
        <p className="text-sm">{t("noEvents")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--background)" }}>
      {GROUP_ORDER.filter((g) => groups.has(g)).map((groupKey) => {
        const groupEvents = groups.get(groupKey)!;
        const isCollapsed = collapsed.has(groupKey);
        return (
          <div key={groupKey}>
            <GroupHeader
              groupKey={groupKey}
              count={groupEvents.length}
              expanded={!isCollapsed}
              onToggle={() => toggleGroup(groupKey)}
            />
            {!isCollapsed && groupEvents.map((event) => <EventRow key={event.id} event={event} />)}
          </div>
        );
      })}
    </div>
  );
}
