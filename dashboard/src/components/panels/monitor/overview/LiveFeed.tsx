"use client";

import { MonitorDot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMonitorStore, type LiveEvent, type LiveEventType } from "@/stores/monitor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 50;
const REFRESH_INTERVAL = 10_000;

/** Format a timestamp into a relative string like "3s ago" / "2m ago". */
function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, Math.floor((now - ts) / 1000));
  if (diff < 60) {
    return `${diff}s`;
  }
  if (diff < 3600) {
    return `${Math.floor(diff / 60)}m`;
  }
  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h`;
  }
  return `${Math.floor(diff / 86400)}d`;
}

/** CSS variable based colors for event types. */
const TYPE_COLORS: Record<LiveEventType, { dot: string; badge: string }> = {
  tool_call: {
    dot: "bg-[var(--accent)]",
    badge: "bg-[var(--accent-muted)] text-[var(--accent)] border-0",
  },
  chat: {
    dot: "bg-[var(--success)]",
    badge: "bg-[var(--success-muted)] text-[var(--success-muted-text)] border-0",
  },
  status: {
    dot: "bg-[var(--warning)]",
    badge: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)] border-0",
  },
  agent: {
    dot: "bg-[var(--danger)]",
    badge: "bg-[var(--danger-muted)] text-[var(--danger-muted-text)] border-0",
  },
  system: {
    dot: "bg-[var(--text-secondary)]",
    badge: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)] border-0",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiveFeed() {
  const t = useTranslations("monitor");
  const events = useMonitorStore((s) => s.liveEvents);
  const addLiveEvent = useMonitorStore((s) => s.addLiveEvent);
  const fetchRecentLiveEvents = useMonitorStore((s) => s.fetchRecentLiveEvents);
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch initial events + periodic refresh for "now" display
  useEffect(() => {
    void fetchRecentLiveEvents();
    intervalRef.current = setInterval(() => {
      setNow(Date.now());
    }, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchRecentLiveEvents]);

  // SSE subscription for real-time events
  useEffect(() => {
    const es = new EventSource("/api/stream");

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as LiveEvent;
        if (data.id && data.description) {
          addLiveEvent({
            id: data.id,
            timestamp: data.timestamp ?? Date.now(),
            type: data.type ?? "system",
            agentId: data.agentId,
            agentName: data.agentName,
            description: data.description,
            details: data.details,
          });
        }
      } catch {
        // Malformed payload -- ignore.
      }
    };

    es.addEventListener("activity.event", handler);

    return () => {
      es.removeEventListener("activity.event", handler);
      es.close();
    };
  }, [addLiveEvent]);

  const visible = useMemo(
    () => events.toSorted((a, b) => b.timestamp - a.timestamp).slice(0, MAX_VISIBLE),
    [events],
  );

  if (visible.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 gap-2 text-[var(--text-tertiary)]">
          <MonitorDot className="size-8 opacity-40" />
          <span className="text-sm">{t("noEvents")}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-[var(--border)]">
          {visible.map((event) => {
            const colors = TYPE_COLORS[event.type] ?? TYPE_COLORS.system;
            return (
              <li
                key={event.id}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {/* Status dot */}
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${colors.badge}`}>
                      {t(`eventType.${event.type}`)}
                    </Badge>
                    {event.agentName && (
                      <span className="text-[11px] text-[var(--text-secondary)] truncate">
                        {event.agentName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed break-words">
                    {event.description}
                  </p>
                  {event.details && (
                    <p className="text-[11px] text-[var(--text-tertiary)] break-words">
                      {event.details}
                    </p>
                  )}
                </div>

                {/* Relative time */}
                <span className="text-[10px] tabular-nums text-[var(--text-tertiary)] pt-0.5 shrink-0">
                  {relativeTime(event.timestamp, now)}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
