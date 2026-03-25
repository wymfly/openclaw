"use client";

import { ArrowRight, ExternalLink, GitBranch, Trash2, User, Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { LineageTree } from "@/components/shared/LineageTree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { navigateToSession, navigateToSubagents } from "@/lib/panel-navigation";
import { cn } from "@/lib/utils";
import { useDeckSubagentsStore } from "@/stores/deck-subagents";
import { useSessionsStore, type HistoryMessage, type SessionEntry } from "@/stores/sessions";
import { SessionExport } from "./SessionExport";
import { TranscriptSearch } from "./TranscriptSearch";

// ---------------------------------------------------------------------------
// Status badge config (mirrors SessionList)
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { cssVar: string; key: string }> = {
  running: { cssVar: "var(--primary)", key: "statusRunning" },
  done: { cssVar: "var(--success)", key: "statusDone" },
  failed: { cssVar: "var(--destructive)", key: "statusFailed" },
  killed: { cssVar: "var(--warning)", key: "statusKilled" },
  timeout: { cssVar: "var(--warning)", key: "statusTimeout" },
  idle: { cssVar: "var(--neutral-muted-text)", key: "statusIdle" },
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

function formatTime(ts: number): string {
  if (!ts) {
    return "";
  }
  return new Date(ts).toLocaleString();
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

function HistoryBubble({ message }: { message: HistoryMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3 mb-4 transition-panel", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-full flex items-center justify-center ring-1",
          isUser
            ? "bg-[var(--primary-muted)] text-[var(--primary)] ring-[var(--primary)]/20"
            : "bg-[var(--muted)] text-[var(--muted-foreground)] ring-[var(--border)]",
        )}
      >
        {isUser ? <User size={12} /> : <Bot size={12} />}
      </div>

      {/* Content */}
      <div
        className={cn("flex flex-col max-w-[75%] min-w-0", isUser ? "items-end" : "items-start")}
      >
        <div
          className={cn(
            "px-3 py-2 text-sm leading-relaxed",
            isUser
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] rounded-2xl rounded-br-md"
              : "bg-[var(--muted)] text-[var(--foreground)] rounded-2xl rounded-bl-md ring-1 ring-[var(--border-subtle)]",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {message.timestamp && (
          <span className="text-[10px] mt-1 px-1 text-[var(--muted-foreground)] font-mono">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}

export function SessionDetail() {
  const t = useTranslations("sessions");
  const tc = useTranslations("common");
  const { sessions, selectedKey, history, deleteSession } = useSessionsStore();
  const { lineage, fetchLineage } = useDeckSubagentsStore();
  const [confirming, setConfirming] = useState(false);
  const [highlightIndices, setHighlightIndices] = useState<number[]>([]);
  const bubbleRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleSearchNavigate = useCallback((index: number) => {
    bubbleRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const session = sessions.find((s) => s.key === selectedKey);
  const isSubagent = selectedKey ? selectedKey.includes(":subagent:") : false;

  // Fetch lineage for subagent sessions
  useEffect(() => {
    if (isSubagent && selectedKey) {
      void fetchLineage({ sessionKey: selectedKey });
    }
  }, [isSubagent, selectedKey, fetchLineage]);

  if (!session) {
    return null;
  }

  const pct = contextPct(session);

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    void deleteSession(session.key);
    setConfirming(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="text-sm font-semibold truncate font-mono text-[var(--foreground)]"
              title={session.key}
            >
              {session.key}
            </h3>
            {/* Status badge */}
            {session.status && STATUS_CONFIG[session.status] && (
              <Badge
                className="text-[10px] h-auto py-0.5 shrink-0"
                style={{
                  color: STATUS_CONFIG[session.status].cssVar,
                  backgroundColor: `color-mix(in srgb, ${STATUS_CONFIG[session.status].cssVar} 12%, transparent)`,
                  borderColor: `color-mix(in srgb, ${STATUS_CONFIG[session.status].cssVar} 25%, transparent)`,
                }}
              >
                {t(STATUS_CONFIG[session.status].key)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {session.model && (
              <span className="text-xs text-[var(--muted-foreground)]">
                {t("model")}: <span className="font-mono">{session.model}</span>
              </span>
            )}
            {session.updatedAt > 0 && (
              <span className="text-xs text-[var(--muted-foreground)]">
                {t("updatedAt")}: {formatTime(session.updatedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <SessionExport session={session} messages={history} />
          <Button
            variant={confirming ? "destructive" : "ghost"}
            size="icon-sm"
            title={confirming ? t("confirmDelete") : tc("delete")}
            onClick={handleDelete}
            onBlur={() => setConfirming(false)}
            className={cn(
              "cursor-pointer",
              !confirming &&
                "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>

      {/* Lineage block for subagent sessions */}
      {isSubagent && (
        <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <GitBranch size={14} className="text-purple-400" />
                <span className="text-xs font-medium text-[var(--foreground)]">
                  Subagent Lineage
                </span>
              </div>
              <button
                type="button"
                onClick={navigateToSubagents}
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-medium cursor-pointer",
                  "text-[var(--primary)] hover:text-[var(--primary)]/80",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                )}
              >
                View in Subagents panel
                <ArrowRight size={10} />
              </button>
            </div>
            <LineageTree nodes={lineage} rootSessionKey={selectedKey ?? ""} />
          </div>
        </div>
      )}

      {/* Stats + context bar */}
      <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-6 mb-2 flex-wrap">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              {t("tokensIn")}
            </span>
            <p className="text-sm font-semibold font-mono text-[var(--foreground)]">
              {formatTokens(session.tokensIn)}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              {t("tokensOut")}
            </span>
            <p className="text-sm font-semibold font-mono text-[var(--foreground)]">
              {formatTokens(session.tokensOut)}
            </p>
          </div>
          {typeof session.totalTokens === "number" && session.totalTokens > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                {t("tokensIn")} + {t("tokensOut")}
              </span>
              <p className="text-sm font-semibold font-mono text-[var(--foreground)]">
                {formatTokens(session.totalTokens)}
              </p>
            </div>
          )}
          {typeof session.estimatedCostUsd === "number" && session.estimatedCostUsd > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                Cost
              </span>
              <p className="text-sm font-semibold font-mono text-[var(--foreground)]">
                ${session.estimatedCostUsd.toFixed(4)}
              </p>
            </div>
          )}
        </div>

        {session.contextWindow > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--muted-foreground)]">{t("context")}</span>
              <span className={cn("text-xs font-semibold font-mono", pressureTextClass(pct))}>
                {pct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-[var(--muted)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  pressureBarClass(pct),
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Subagent info section (only for subagent sessions) */}
      {isSubagent && (session.subagentRole || session.subagentControlScope || session.spawnedWorkspaceDir) && (
        <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            {session.subagentRole && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t("subagentRole")}
                </span>
                <p className="text-xs font-medium text-[var(--foreground)]">
                  {session.subagentRole === "orchestrator"
                    ? t("subagentRoleOrchestrator")
                    : t("subagentRoleLeaf")}
                </p>
              </div>
            )}
            {session.subagentControlScope && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t("subagentControlScope")}
                </span>
                <p className="text-xs font-medium text-[var(--foreground)]">
                  {session.subagentControlScope === "children"
                    ? t("subagentControlScopeChildren")
                    : t("subagentControlScopeNone")}
                </p>
              </div>
            )}
            {session.spawnedWorkspaceDir && (
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t("spawnedWorkspaceDir")}
                </span>
                <p className="text-xs font-mono text-[var(--foreground)] truncate" title={session.spawnedWorkspaceDir}>
                  {session.spawnedWorkspaceDir}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Parent/child session navigation */}
      {(session.parentSessionKey || (session.childSessions && session.childSessions.length > 0)) && (
        <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
          {session.parentSessionKey && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] shrink-0">
                {t("parentSession")}
              </span>
              <button
                type="button"
                onClick={() => navigateToSession(session.parentSessionKey!)}
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-mono cursor-pointer truncate",
                  "text-[var(--primary)] hover:text-[var(--primary)]/80 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                )}
                title={session.parentSessionKey}
              >
                {session.parentSessionKey.length > 40
                  ? `${session.parentSessionKey.slice(0, 40)}...`
                  : session.parentSessionKey}
                <ExternalLink size={10} className="shrink-0" />
              </button>
            </div>
          )}
          {session.childSessions && session.childSessions.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                {t("childSessions")} ({session.childSessions.length})
              </span>
              <div className="flex flex-col gap-0.5 mt-1">
                {session.childSessions.map((childKey) => (
                  <button
                    key={childKey}
                    type="button"
                    onClick={() => navigateToSession(childKey)}
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-mono cursor-pointer truncate text-left",
                      "text-[var(--primary)] hover:text-[var(--primary)]/80 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                    )}
                    title={childKey}
                  >
                    {childKey.length > 50 ? `${childKey.slice(0, 50)}...` : childKey}
                    <ExternalLink size={10} className="shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transcript search */}
      {history.length > 0 && (
        <TranscriptSearch
          messages={history}
          onHighlight={setHighlightIndices}
          onNavigate={handleSearchNavigate}
        />
      )}

      {/* Conversation history */}
      <ScrollArea className="flex-1 px-5 py-4">
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
            <p className="text-sm">{t("history")}</p>
          </div>
        ) : (
          history.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              ref={(el) => {
                bubbleRefs.current[i] = el;
              }}
              className={cn(
                highlightIndices.includes(i) && "ring-2 ring-[var(--primary)] rounded-lg",
              )}
            >
              <HistoryBubble message={msg} />
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
