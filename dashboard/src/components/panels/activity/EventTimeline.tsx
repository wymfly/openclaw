"use client";

import { Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useActivityStore, type ActivityEventType } from "@/stores/activity";

const TYPE_BADGE_STYLES: Record<ActivityEventType, string> = {
  tool_call: "bg-[var(--purple-muted)] text-[var(--purple)]",
  chat: "bg-[var(--accent-muted)] text-[var(--accent)]",
  status: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]",
  agent: "bg-[var(--success-muted)] text-[var(--success)]",
  system: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
};

const TYPE_DOT_COLORS: Record<ActivityEventType, string> = {
  tool_call: "bg-[var(--purple)]",
  chat: "bg-[var(--accent)]",
  status: "bg-[var(--warning)]",
  agent: "bg-[var(--success)]",
  system: "bg-[var(--neutral-muted-text)]",
};

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

export function EventTimeline() {
  const t = useTranslations("activity");
  const events = useActivityStore((s) => s.events);
  const filters = useActivityStore((s) => s.filters);

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
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[var(--text-secondary)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
          <Activity size={20} className="text-[var(--accent)]" />
        </div>
        <p className="text-sm">{t("noEvents")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {filtered.map((event) => (
        <div
          key={event.id}
          className="group relative flex items-start gap-3 py-2.5 transition-panel"
        >
          {/* Timeline dot + line */}
          <div className="flex flex-col items-center shrink-0 pt-0.5">
            <div
              className={cn(
                "w-2 h-2 rounded-full ring-2 ring-[var(--bg-secondary)]",
                TYPE_DOT_COLORS[event.type] ?? TYPE_DOT_COLORS.system,
              )}
            />
            <div className="w-px flex-1 bg-[var(--border-subtle)] mt-1 group-last:hidden" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pb-2">
            {/* Top row: badge + agent + time */}
            <div className="flex items-center gap-2 mb-1">
              <Badge
                className={cn(
                  "font-medium text-[10px] h-auto py-0.5",
                  TYPE_BADGE_STYLES[event.type] ?? TYPE_BADGE_STYLES.system,
                )}
              >
                {event.type}
              </Badge>

              {(event.agentName ?? event.agentId) && (
                <span className="text-xs font-medium text-[var(--accent)]">
                  {event.agentName ?? event.agentId}
                </span>
              )}

              <span className="text-[10px] font-mono text-[var(--text-secondary)] ml-auto shrink-0">
                {relativeTime(event.timestamp)}
              </span>
            </div>

            {/* Description */}
            <p className="text-xs text-[var(--text-primary)] break-words">{event.description}</p>

            {/* Details */}
            {event.details && (
              <pre className="text-[11px] mt-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-mono max-h-[60px] overflow-hidden break-words whitespace-pre-wrap">
                {event.details}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
