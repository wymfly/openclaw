"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] shrink-0 flex-wrap">
        <h2 className="text-sm font-semibold shrink-0 text-[var(--text-primary)]">{t("title")}</h2>

        {/* Agent filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t("agent")}:</span>
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
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t("type")}:</span>
          <Select
            value={filters.eventType ?? "all"}
            onValueChange={(val) => {
              setTypeFilter(val === "all" ? null : (val as ActivityEventType));
            }}
          >
            <SelectTrigger className="w-[120px] h-7 text-xs" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(EVENT_TYPE_LABEL_KEYS[type] ?? type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Event timeline */}
      <EventTimeline />
    </div>
  );
}
