"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useActivityStore, type ActivityEventType } from "@/stores/activity";
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
  system: "type",
};

export function ActivityPanel() {
  const t = useTranslations("activity");
  const { filters, setAgentFilter, setTypeFilter, fetchRecent } = useActivityStore();

  useActivitySSE();

  useEffect(() => {
    void fetchRecent();
  }, [fetchRecent]);

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden border border-border">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-wrap">
        <h2 className="text-sm font-semibold shrink-0 text-foreground">{t("title")}</h2>

        {/* Agent filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("agent")}:</span>
          <Input
            type="text"
            value={filters.agentId ?? ""}
            onChange={(e) => setAgentFilter(e.target.value || null)}
            placeholder={t("allAgents")}
            className="text-xs h-7 w-[140px]"
          />
        </div>

        {/* Event type filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("type")}:</span>
          <select
            value={filters.eventType ?? "all"}
            onChange={(e) => {
              const val = e.target.value;
              setTypeFilter(val === "all" ? null : (val as ActivityEventType));
            }}
            className="text-xs rounded-lg px-2 py-1 border border-input bg-transparent text-foreground"
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
