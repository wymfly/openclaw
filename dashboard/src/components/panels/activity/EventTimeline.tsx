"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useActivityStore, type ActivityEventType } from "@/stores/activity";

const TYPE_BADGE_STYLES: Record<ActivityEventType, string> = {
  tool_call: "bg-[var(--purple-muted)] text-[var(--purple)]",
  chat: "bg-[var(--accent-muted)] text-[var(--accent)]",
  status: "bg-[var(--warning-muted)] text-[var(--warning)]",
  agent: "bg-[var(--success-muted)] text-[var(--success)]",
  system: "bg-muted text-muted-foreground",
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
      <div className="flex items-center justify-center flex-1 text-muted-foreground">
        <p className="text-sm">{t("noEvents")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 bg-background">
      {filtered.map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-3 py-2 border-b border-border last:border-b-0"
        >
          {/* Timestamp */}
          <span className="text-xs shrink-0 pt-0.5 text-muted-foreground font-mono min-w-[60px]">
            {relativeTime(event.timestamp)}
          </span>

          {/* Type badge */}
          <Badge
            className={cn(
              "shrink-0 font-medium text-[10px] min-w-[60px] text-center h-auto py-0.5",
              TYPE_BADGE_STYLES[event.type] ?? TYPE_BADGE_STYLES.system,
            )}
          >
            {event.type}
          </Badge>

          {/* Agent name */}
          {(event.agentName ?? event.agentId) && (
            <span className="text-xs shrink-0 font-medium pt-0.5 text-primary min-w-[60px]">
              {event.agentName ?? event.agentId}
            </span>
          )}

          {/* Description + details */}
          <div className="flex-1 min-w-0">
            <p className="text-xs break-words text-foreground">{event.description}</p>
            {event.details && (
              <p className="text-xs mt-0.5 break-words text-muted-foreground font-mono max-h-[60px] overflow-hidden">
                {event.details}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
