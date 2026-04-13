"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowRight, ExternalLink, GitBranch, Minimize2, Trash2, User, Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { InlineEdit } from "@/components/lists";
import { LineageTree } from "@/components/shared/LineageTree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { navigateToSession, navigateToSubagents } from "@/lib/panel-navigation";
import { cn } from "@/lib/utils";
import { useDeckSubagentsStore } from "@/stores/deck-subagents";
import { useSessionsStore, type HistoryMessage } from "@/stores/sessions";
import { TranscriptBlocks } from "../chat/TranscriptBlocks";
import { CompactionHistory } from "./CompactionHistory";
import { ContextWeightBreakdown } from "./ContextWeightBreakdown";
import { SessionExport } from "./SessionExport";
import { TranscriptSearch } from "./TranscriptSearch";
import { TurnTimeline } from "./TurnTimeline";

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

import { contextPct, pressureBarClass, pressureTextClass } from "@/lib/context-utils";

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

function HistoryBubble({
  message,
  showCompactionSeparator,
}: {
  message: HistoryMessage;
  showCompactionSeparator?: boolean;
}) {
  const t = useTranslations("sessions");
  const isUser = message.role === "user";

  if (message.isCompaction) {
    return (
      <>
        {showCompactionSeparator && (
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 border-t border-dashed border-[var(--warning)]/40" />
            <span className="text-[10px] text-[var(--warning-muted-text)] shrink-0">
              {t("compressedMessages")}
            </span>
            <div className="flex-1 border-t border-dashed border-[var(--warning)]/40" />
          </div>
        )}
        <div className="flex gap-3 mb-4 transition-panel">
          <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center ring-1 bg-[var(--warning-muted)] text-[var(--warning)] ring-[var(--warning)]/20">
            <Minimize2 size={12} />
          </div>
          <div className="flex flex-col max-w-[75%] min-w-0 items-start">
            <div className="rounded-lg px-3 py-2 bg-[var(--warning-muted)] text-[var(--foreground)]">
              <div className="flex items-center gap-1.5 mb-1">
                <Minimize2 size={11} className="text-[var(--warning)]" />
                <span className="text-[11px] font-semibold text-[var(--warning)]">
                  {t("compactionSummary")}
                </span>
              </div>
              <TranscriptBlocks message={message} isUser={false} />
            </div>
            {message.timestamp && (
              <span className="text-[10px] mt-1 px-1 text-[var(--muted-foreground)] font-mono">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </>
    );
  }

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
        <TranscriptBlocks message={message} isUser={isUser} />
        {message.timestamp && (
          <span className="text-[10px] mt-1 px-1 text-[var(--muted-foreground)] font-mono">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}

function VirtualizedHistory({
  history,
  highlightIndices,
  bubbleRefs,
  scrollToIndexRef,
}: {
  history: HistoryMessage[];
  highlightIndices: number[];
  bubbleRefs: React.RefObject<(HTMLDivElement | null)[]>;
  scrollToIndexRef?: React.RefObject<((index: number) => void) | null>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: history.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      const msg = history[i];
      const hasTools = msg.content.some((b) => b.type === "tool_use" || b.type === "tool_result");
      return hasTools ? 200 : 80;
    },
    overscan: 5,
  });

  // Expose scrollToIndex for search navigation from parent
  useEffect(() => {
    if (scrollToIndexRef && "current" in scrollToIndexRef) {
      (scrollToIndexRef as React.MutableRefObject<((index: number) => void) | null>).current = (
        index: number,
      ) => {
        virtualizer.scrollToIndex(index, { align: "center" });
      };
    }
  }, [virtualizer, scrollToIndexRef]);

  return (
    <div ref={parentRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const msg = history[virtualItem.index];
          const i = virtualItem.index;
          return (
            <div
              key={`${msg.role}-${i}`}
              data-index={i}
              ref={(el) => {
                virtualizer.measureElement(el);
                bubbleRefs.current[i] = el;
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className={cn(
                highlightIndices.includes(i) && "ring-2 ring-[var(--primary)] rounded-lg",
              )}
            >
              <HistoryBubble message={msg} showCompactionSeparator={msg.isCompaction && i > 0} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SessionDetail() {
  const t = useTranslations("sessions");
  const tc = useTranslations("common");
  const { sessions, selectedKey, history, deleteSession, patchSession, compactSession } =
    useSessionsStore();
  const { lineage, fetchLineage } = useDeckSubagentsStore();
  const [confirming, setConfirming] = useState(false);
  const [compactConfirming, setCompactConfirming] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);

  const handlePatch = useCallback(
    async (patch: Parameters<typeof patchSession>[1]) => {
      setPatchError(null);
      if (!selectedKey) {
        return;
      }
      const ok = await patchSession(selectedKey, patch);
      if (!ok) {
        setPatchError(t("patchFailed"));
        setTimeout(() => setPatchError(null), 3000);
      }
    },
    [selectedKey, patchSession, t],
  );
  const [viewMode, setViewMode] = useState<"transcript" | "timeline">("transcript");
  const [highlightIndices, setHighlightIndices] = useState<number[]>([]);
  const bubbleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollToIndexRef = useRef<((index: number) => void) | null>(null);

  const handleSearchNavigate = useCallback((index: number) => {
    // Use virtualizer's scrollToIndex for reliable off-screen navigation
    if (scrollToIndexRef.current) {
      scrollToIndexRef.current(index);
      return;
    }
    // Fallback for non-virtualized contexts
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

  const handleCompact = () => {
    if (!compactConfirming) {
      setCompactConfirming(true);
      return;
    }
    setCompactConfirming(false);
    setCompacting(true);
    void compactSession(session.key).then((result) => {
      setCompacting(false);
      if (!result.ok) {
        setPatchError(t("compactFailed", { reason: result.reason ?? "" }));
        setTimeout(() => setPatchError(null), 3000);
      }
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Patch error banner */}
      {patchError && (
        <div
          className="px-4 py-2 text-xs shrink-0"
          style={{ backgroundColor: "var(--destructive-muted)", color: "var(--destructive)" }}
        >
          {patchError}
        </div>
      )}
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* Editable label */}
            <InlineEdit
              type="text"
              value={session.label ?? ""}
              placeholder={session.key.length > 30 ? `${session.key.slice(0, 30)}…` : session.key}
              onConfirm={(newLabel: string) => {
                void handlePatch({ label: newLabel || null });
              }}
              className="text-sm font-semibold text-[var(--foreground)]"
            />
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
          {/* Session key (always visible, non-editable) */}
          <span
            className="text-[10px] font-mono text-[var(--muted-foreground)] truncate block mt-0.5"
            title={session.key}
          >
            {session.key}
          </span>
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
          {session.contextWindow > 0 && pct >= 20 && (
            <Button
              variant={compactConfirming ? "default" : "ghost"}
              size="icon-sm"
              title={compactConfirming ? t("compactConfirm") : t("compact")}
              onClick={handleCompact}
              onBlur={() => setCompactConfirming(false)}
              disabled={compacting}
              className={cn(
                "cursor-pointer",
                !compactConfirming &&
                  !compacting &&
                  "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {compacting ? (
                <span className="animate-spin text-[10px]">⟳</span>
              ) : (
                <Minimize2 size={15} />
              )}
            </Button>
          )}
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
                {t("tokensCurrent")}
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

      {/* Context weight breakdown (lazy-loaded on expand) */}
      {session.contextWindow > 0 && (
        <ContextWeightBreakdown sessionKey={session.key} contextWindow={session.contextWindow} />
      )}

      {/* Compaction history (lazy-loaded on expand) */}
      <CompactionHistory sessionKey={session.key} compactionCount={session.compactionCount} />

      {/* Session directives: thinkingLevel + fastMode */}
      <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-6 flex-wrap">
          {/* thinkingLevel */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              {t("thinkingLevel")}
            </span>
            <div className="mt-0.5">
              <InlineEdit
                type="select"
                value={session.thinkingLevel ?? "off"}
                options={[
                  { value: "off", label: t("thinkingOff") },
                  { value: "low", label: t("thinkingLow") },
                  { value: "medium", label: t("thinkingMedium") },
                  { value: "high", label: t("thinkingHigh") },
                ]}
                onConfirm={(val: string) => {
                  void handlePatch({ thinkingLevel: val });
                }}
                className="text-xs"
              />
            </div>
          </div>
          {/* fastMode */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              {t("fastMode")}
            </span>
            <div className="mt-1">
              <button
                type="button"
                onClick={() => {
                  void handlePatch({ fastMode: !session.fastMode });
                }}
                className="relative w-8 h-4 rounded-full transition-colors cursor-pointer"
                style={{
                  backgroundColor: session.fastMode ? "var(--primary)" : "var(--muted)",
                }}
              >
                <span
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-[var(--primary-foreground)] transition-transform shadow-sm"
                  style={{
                    transform: session.fastMode ? "translateX(16px)" : "translateX(2px)",
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subagent info section (only for subagent sessions) */}
      {isSubagent &&
        (session.subagentRole || session.subagentControlScope || session.spawnedWorkspaceDir) && (
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
                  <p
                    className="text-xs font-mono text-[var(--foreground)] truncate"
                    title={session.spawnedWorkspaceDir}
                  >
                    {session.spawnedWorkspaceDir}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Parent/child session navigation */}
      {(session.parentSessionKey ||
        (session.childSessions && session.childSessions.length > 0)) && (
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

      {/* View mode toggle + Transcript search */}
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-2 shrink-0">
        <div className="inline-flex rounded-md border border-[var(--border)] overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("transcript")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium transition-colors cursor-pointer",
              viewMode === "transcript"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
            )}
          >
            {t("timeline.transcript")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium transition-colors cursor-pointer",
              viewMode === "timeline"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
            )}
          >
            {t("timeline.timeline")}
          </button>
        </div>
        {viewMode === "transcript" && history.length > 0 && (
          <div className="flex-1">
            <TranscriptSearch
              messages={history}
              onHighlight={setHighlightIndices}
              onNavigate={handleSearchNavigate}
            />
          </div>
        )}
      </div>

      {/* Conversation history / Timeline — virtualized for performance */}
      {viewMode === "timeline" ? (
        <ScrollArea className="flex-1 min-h-0 px-5 py-4">
          <TurnTimeline sessionKey={session.key} />
        </ScrollArea>
      ) : history.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-[var(--muted-foreground)]">
          <p className="text-sm">{t("history")}</p>
        </div>
      ) : (
        <VirtualizedHistory
          history={history}
          highlightIndices={highlightIndices}
          bubbleRefs={bubbleRefs}
          scrollToIndexRef={scrollToIndexRef}
        />
      )}
    </div>
  );
}
