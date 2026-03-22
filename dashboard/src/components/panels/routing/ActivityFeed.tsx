"use client";

import { Activity, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { AgentBadge } from "@/components/shared/AgentBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActivityStore } from "@/stores/activity";

/** Format a timestamp into a relative string like "3s ago" / "2m ago". */
function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, Math.floor((now - ts) / 1000));
  if (diff < 60) {
    return `${diff}s ago`;
  }
  if (diff < 3600) {
    return `${Math.floor(diff / 60)}m ago`;
  }
  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h ago`;
  }
  return `${Math.floor(diff / 86400)}d ago`;
}

const MAX_DISPLAY = 20;
const REFRESH_INTERVAL = 10_000;

/**
 * Activity feed — shows recent agent/chat events from the activity store.
 * Degraded version of a full routing hit log (which requires Gateway telemetry).
 */
export function ActivityFeed() {
  const t = useTranslations("routing");
  const events = useActivityStore((s) => s.events);
  const fetchRecent = useActivityStore((s) => s.fetchRecent);
  const [agentFilter, setAgentFilter] = useState("__all__");
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-refresh: fetch recent + update "now" every 10s
  useEffect(() => {
    void fetchRecent();
    intervalRef.current = setInterval(() => {
      void fetchRecent();
      setNow(Date.now());
    }, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchRecent]);

  // Filter agent/chat events, apply agent filter, limit to 20
  const filtered = useMemo(() => {
    return events
      .filter((e) => e.type === "agent" || e.type === "chat")
      .filter((e) => agentFilter === "__all__" || e.agentId === agentFilter)
      .toSorted((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_DISPLAY);
  }, [events, agentFilter]);

  // Unique agents for filter dropdown
  const uniqueAgents = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      if (e.agentId) {
        map.set(e.agentId, e.agentName ?? e.agentId);
      }
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("activityFeed")}</h3>
        <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? "__all__")}>
          <SelectTrigger className="w-[160px] h-7 text-xs">
            <SelectValue placeholder={t("agentFilter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allAgents")}</SelectItem>
            {uniqueAgents.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-4 py-2 text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] border-b border-[var(--border)] shrink-0">
        <Info className="size-3.5 mt-0.5 shrink-0" />
        <span>{t("activityBanner")}</span>
      </div>

      {/* Event list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--text-tertiary)]">
            <Activity className="size-8 opacity-40" />
            <span className="text-sm">{t("noActivity")}</span>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((event) => (
              <li
                key={event.id}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {/* Timestamp */}
                <span className="text-[10px] tabular-nums text-[var(--text-tertiary)] pt-0.5 shrink-0 w-14 text-right">
                  {relativeTime(event.timestamp, now)}
                </span>

                {/* Agent badge */}
                {event.agentId && (
                  <AgentBadge agentId={event.agentId} agentName={event.agentName} />
                )}

                {/* Description */}
                <span className="text-xs text-[var(--text-secondary)] leading-relaxed min-w-0 break-words">
                  {event.description}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer — event count */}
      <div className="px-4 py-1.5 text-[10px] text-[var(--text-tertiary)] border-t border-[var(--border)] shrink-0 text-right">
        {t("showingActivity", { count: filtered.length })}
      </div>
    </div>
  );
}
