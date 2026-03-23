"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { AgentBadge } from "@/components/shared/AgentBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { navigateToSession } from "@/lib/panel-navigation";
import { cn } from "@/lib/utils";
import { useSessionsStore } from "@/stores/sessions";

interface SessionsTabProps {
  agentId: string;
}

type SessionFilter = "all" | "direct" | "group" | "global" | "subagent";

const FILTER_OPTIONS: { value: SessionFilter; labelKey: string }[] = [
  { value: "all", labelKey: "sessionTypeAll" },
  { value: "direct", labelKey: "sessionTypeDM" },
  { value: "group", labelKey: "sessionTypeGroup" },
  { value: "global", labelKey: "sessionTypeChannel" },
  { value: "subagent", labelKey: "sessionTypeSubagent" },
];

const KIND_BADGE: Record<string, string> = {
  direct: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  group: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  global: "bg-teal-500/15 text-teal-400 border-teal-500/25",
  unknown: "bg-gray-500/15 text-gray-400 border-gray-500/25",
};

/** Check if a session key indicates a subagent session */
function isSubagentSession(key: string): boolean {
  return key.includes(":subagent:") || key.includes(":spawn:");
}

/** Extract depth from session key if subagent pattern is present */
function extractDepth(key: string): number | null {
  const match = key.match(/:depth[=:](\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Extract parent agent ID from session key */
function extractParentAgent(key: string): string | null {
  const match = key.match(/:parent[=:]([^:]+)/);
  return match ? match[1] : null;
}

function formatTime(ts: number): string {
  if (!ts) {
    return "—";
  }
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionsTab({ agentId }: SessionsTabProps) {
  const t = useTranslations("agentDetail");
  const ts = useTranslations("sessions");
  const { sessions, loading, fetchSessions } = useSessionsStore();
  const [filter, setFilter] = useState<SessionFilter>("all");

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  // Filter sessions belonging to this agent (by key containing agentId)
  const agentSessions = useMemo(() => {
    return sessions.filter((s) => s.key.includes(agentId));
  }, [sessions, agentId]);

  const filteredSessions = useMemo(() => {
    if (filter === "all") {
      return agentSessions;
    }
    if (filter === "subagent") {
      return agentSessions.filter((s) => isSubagentSession(s.key));
    }
    return agentSessions.filter((s) => s.kind === filter);
  }, [agentSessions, filter]);

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as SessionFilter)}>
          <SelectTrigger className="w-40 h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-[var(--text-secondary)]">
          {filteredSessions.length} / {agentSessions.length}
        </span>
      </div>

      {/* Session list */}
      {loading && sessions.length === 0 && (
        <div className="py-6 text-center text-xs text-[var(--text-secondary)]">Loading...</div>
      )}

      {!loading && filteredSessions.length === 0 && (
        <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
          {t("noSessions")}
        </div>
      )}

      <div className="space-y-1.5">
        {filteredSessions.map((session) => {
          const isSub = isSubagentSession(session.key);
          const depth = isSub ? extractDepth(session.key) : null;
          const parentAgent = isSub ? extractParentAgent(session.key) : null;

          return (
            <Card
              key={session.key}
              className="p-3 bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer hover:border-[var(--accent)]/30 transition-colors"
              onClick={() => navigateToSession(session.key)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] border shrink-0",
                      KIND_BADGE[session.kind] ?? KIND_BADGE.unknown,
                    )}
                  >
                    {ts(session.kind)}
                  </Badge>
                  <span className="text-[10px] font-mono text-[var(--text-secondary)] truncate">
                    {session.key}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-secondary)] shrink-0">
                  {formatTime(session.updatedAt)}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--text-secondary)]">
                {session.model && <span className="font-mono">{session.model}</span>}
                <span>
                  {ts("tokensIn")}: {session.tokensIn.toLocaleString()}
                </span>
                <span>
                  {ts("tokensOut")}: {session.tokensOut.toLocaleString()}
                </span>
              </div>

              {/* Subagent metadata */}
              {isSub && (
                <div className="flex items-center gap-3 mt-1.5">
                  {depth !== null && (
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {t("depth")}: {depth}
                    </span>
                  )}
                  {parentAgent && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {t("parentAgent")}:
                      </span>
                      <AgentBadge agentId={parentAgent} />
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
