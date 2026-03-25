"use client";

import { Hash, Link2, Smartphone, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AgentBadge } from "@/components/shared/AgentBadge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionsStore, type SessionEntry, type SessionKind } from "@/stores/sessions";

// ---------------------------------------------------------------------------
// Session type inference
// ---------------------------------------------------------------------------

export type SessionType = "dm" | "group" | "channel" | "subagent";

const TYPE_ICONS: Record<SessionType, ReactNode> = {
  dm: <Smartphone size={12} />,
  group: <Users size={12} />,
  channel: <Hash size={12} />,
  subagent: <Link2 size={12} />,
};

const TYPE_STYLES: Record<SessionType, string> = {
  dm: "text-blue-400",
  group: "text-emerald-400",
  channel: "text-amber-400",
  subagent: "text-purple-400",
};

export function inferSessionType(key: string): SessionType {
  if (key.includes(":subagent:")) {
    return "subagent";
  }
  if (key.includes(":channel:")) {
    return "channel";
  }
  if (key.includes(":group:")) {
    return "group";
  }
  return "dm";
}

function inferSubagentDepth(key: string): number {
  const matches = key.match(/:subagent:/g);
  return matches ? matches.length : 0;
}

/** Extract the first agent-like segment from a session key. */
function extractAgentId(key: string): string | null {
  // Session keys typically start with "kind:agentId:..." or contain ":agent=agentId:"
  const agentMatch = key.match(/:agent[=:]([^:]+)/);
  if (agentMatch) {
    return agentMatch[1];
  }
  // Try second segment (kind:agentId:rest)
  const parts = key.split(":");
  if (parts.length >= 2 && parts[1]) {
    return parts[1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { cssVar: string; key: string }> = {
  running: { cssVar: "var(--primary)", key: "statusRunning" },
  done: { cssVar: "var(--success)", key: "statusDone" },
  failed: { cssVar: "var(--destructive)", key: "statusFailed" },
  killed: { cssVar: "var(--warning)", key: "statusKilled" },
  timeout: { cssVar: "var(--warning)", key: "statusTimeout" },
  idle: { cssVar: "var(--neutral-muted-text)", key: "statusIdle" },
};

// ---------------------------------------------------------------------------
// Existing helpers
// ---------------------------------------------------------------------------

const KIND_BADGE_STYLES: Record<SessionKind, string> = {
  direct: "bg-[var(--primary-muted)] text-[var(--primary)]",
  group: "bg-[var(--success-muted)] text-[var(--success)]",
  global: "bg-[var(--purple-muted)] text-[var(--purple)]",
  unknown: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
};

function pressureBarClass(pct: number): string {
  if (pct >= 80) {
    return "bg-[var(--destructive)]";
  }
  if (pct >= 60) {
    return "bg-[var(--warning)]";
  }
  return "bg-[var(--success)]";
}

function pressureTextClass(pct: number): string {
  if (pct >= 80) {
    return "text-[var(--destructive)]";
  }
  if (pct >= 60) {
    return "text-[var(--warning)]";
  }
  return "text-[var(--success)]";
}

function contextPct(session: SessionEntry): number {
  if (session.contextWindow <= 0) {
    return 0;
  }
  const used = session.tokensIn + session.tokensOut;
  return Math.min(100, Math.round((used / session.contextWindow) * 100));
}

function shortKey(key: string, maxLen = 20): string {
  return key.length > maxLen ? `${key.slice(0, maxLen)}...` : key;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionListProps {
  typeFilter?: SessionType | "all";
}

export function SessionList({ typeFilter = "all" }: SessionListProps) {
  const t = useTranslations("sessions");
  const { sessions, selectedKey, selectSession } = useSessionsStore();

  const filtered =
    typeFilter === "all"
      ? sessions
      : sessions.filter((s) => inferSessionType(s.key) === typeFilter);

  return (
    <div className="flex flex-col py-1">
      {filtered.map((session) => {
        const isActive = session.key === selectedKey;
        const pct = contextPct(session);
        const sType = inferSessionType(session.key);
        const agentId = extractAgentId(session.key);

        return (
          <button
            key={session.key}
            type="button"
            className={cn(
              "relative flex flex-col gap-1.5 px-4 py-2.5 text-left transition-colors duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 focus-visible:ring-inset",
              isActive
                ? "bg-[var(--primary-muted)] text-[var(--primary)]"
                : "text-[var(--foreground)] hover:bg-[var(--muted)]",
            )}
            onClick={() => selectSession(session.key)}
          >
            {/* Active indicator */}
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]"
                aria-hidden
              />
            )}

            {/* Top row: type icon + kind badge + key */}
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("shrink-0", TYPE_STYLES[sType])} title={sType}>
                {TYPE_ICONS[sType]}
              </span>
              <Badge className={cn("text-[10px] h-auto py-0.5", KIND_BADGE_STYLES[session.kind])}>
                {t(session.kind)}
              </Badge>
              {sType === "subagent" && (
                <span className="text-[9px] font-mono bg-purple-500/15 text-purple-400 px-1 rounded shrink-0">
                  d{inferSubagentDepth(session.key)}
                </span>
              )}
              {/* Status badge */}
              {session.status && STATUS_CONFIG[session.status] && (
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    color: STATUS_CONFIG[session.status].cssVar,
                    backgroundColor: `color-mix(in srgb, ${STATUS_CONFIG[session.status].cssVar} 12%, transparent)`,
                  }}
                >
                  {t(STATUS_CONFIG[session.status].key)}
                </span>
              )}
              <span className="text-xs font-mono truncate" title={session.key}>
                {shortKey(session.key)}
              </span>
            </div>

            {/* Agent badge (clickable → agents panel) */}
            {agentId && (
              <div className="flex items-center min-w-0 mt-0.5">
                <AgentBadge agentId={agentId} />
              </div>
            )}

            {/* Bottom row: model + context bar */}
            <div className="flex items-center gap-2 min-w-0">
              {session.model && (
                <span className="text-[10px] truncate shrink-0 text-[var(--muted-foreground)]">
                  {session.model}
                </span>
              )}
              {session.contextWindow > 0 && (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="flex-1 h-1 rounded-full overflow-hidden bg-[var(--muted)]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        pressureBarClass(pct),
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={cn("text-[10px] font-mono shrink-0", pressureTextClass(pct))}>
                    {pct}%
                  </span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
