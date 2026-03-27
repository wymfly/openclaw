"use client";

import { Bot, ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import type { SubagentRun } from "@/stores/deck-subagents";

/* ------------------------------------------------------------------ */
/*  SubagentCard — collapsible card for a single subagent run          */
/* ------------------------------------------------------------------ */

export function SubagentCard({ run }: { run: SubagentRun }) {
  const t = useTranslations("chat");
  const isActive = run.status === "active";
  const isFailed = run.status === "failed" || run.status === "timeout";
  const isCompleted = run.status === "completed";

  const [expanded, setExpanded] = useState(isActive);
  const [elapsed, setElapsed] = useState<number | undefined>(
    isActive ? Date.now() - run.createdAt : run.durationMs,
  );

  // Live elapsed timer when active
  useEffect(() => {
    if (!isActive) {
      setElapsed(run.durationMs);
      return;
    }
    setElapsed(Date.now() - run.createdAt);
    const id = setInterval(() => {
      setElapsed(Date.now() - run.createdAt);
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, run.createdAt, run.durationMs]);

  // Auto-expand when active, collapse when completed
  useEffect(() => {
    setExpanded(isActive);
  }, [isActive]);

  const displayName = run.childAgentName ?? run.childAgentId;
  const errorMessage = (run.outcome as { error?: string } | undefined)?.error;

  return (
    <div
      className={cn(
        "mb-2 rounded-lg ring-1 overflow-hidden transition-panel",
        isActive && "ring-[var(--primary)]/40 bg-[var(--primary-muted)]",
        isCompleted && "ring-[var(--success)]/30 bg-[var(--muted)]",
        isFailed && "ring-[var(--destructive)]/30 bg-[var(--destructive-muted)]",
      )}
    >
      {/* Header — collapsible toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm cursor-pointer hover:bg-[var(--muted)]/50 transition-colors"
      >
        <ChevronRight
          size={14}
          className={cn(
            "shrink-0 text-[var(--muted-foreground)] transition-transform duration-150",
            expanded && "rotate-90",
          )}
        />
        <Bot size={14} className="shrink-0 text-[var(--muted-foreground)]" />
        <span className="font-medium text-[var(--foreground)] truncate">{displayName}</span>

        {/* Status badge */}
        <span
          className={cn(
            "ml-auto shrink-0 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full",
            isActive && "bg-[var(--primary)]/15 text-[var(--primary)]",
            isCompleted && "bg-[var(--success)]/15 text-[var(--success)]",
            isFailed && "bg-[var(--destructive)]/15 text-[var(--destructive)]",
          )}
        >
          {isActive && <Loader2 size={10} className="animate-spin" />}
          {isActive && t("subagentRunning")}
          {isCompleted && t("subagentCompleted")}
          {isFailed && t("subagentFailed")}
        </span>

        {/* Duration */}
        <span className="shrink-0 text-[10px] font-mono text-[var(--muted-foreground)]">
          {formatDuration(elapsed)}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-2 text-xs text-[var(--muted-foreground)] space-y-1">
          {run.task && (
            <p>
              <span className="font-medium text-[var(--foreground)]">{t("subagentTask")}:</span>{" "}
              {run.task}
            </p>
          )}
          {errorMessage && (
            <p className="text-[var(--destructive)]">
              <span className="font-medium">{t("subagentError")}:</span> {errorMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
