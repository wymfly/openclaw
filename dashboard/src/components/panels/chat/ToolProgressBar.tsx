"use client";

import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useActiveSessionKey, useSessionToolProgress } from "@/stores/chat-hooks";
import type { ToolProgress } from "@/stores/chat-types";

const COMPLETED_VISIBLE_MS = 3_000;

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  if (elapsed < 1) {
    return null;
  }
  return (
    <span className="text-[10px] text-[var(--text-secondary)] tabular-nums ml-auto">
      {elapsed}s
    </span>
  );
}

function ToolEntry({ tool }: { tool: ToolProgress }) {
  const isRunning = tool.status === "running";
  const isError = tool.status === "error";
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md transition-opacity",
        isRunning
          ? "text-[var(--text-primary)]"
          : isError
            ? "text-[var(--danger)] opacity-70"
            : "text-[var(--success)] opacity-70",
      )}
    >
      {isRunning ? (
        <Loader2 size={12} className="animate-spin shrink-0 text-[var(--accent)]" />
      ) : isError ? (
        <XCircle size={12} className="shrink-0" />
      ) : (
        <CheckCircle2 size={12} className="shrink-0" />
      )}
      <code className="font-mono text-[11px] truncate max-w-[160px]">{tool.name}</code>
      {isRunning && <ElapsedTime startedAt={tool.startedAt} />}
    </div>
  );
}

export function ToolProgressBar() {
  const t = useTranslations("chat");
  const toolProgress = useSessionToolProgress();
  const activeKey = useActiveSessionKey();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Reset hidden IDs when session changes to prevent stale cross-session state
  const prevKeyRef = useRef(activeKey);
  useEffect(() => {
    if (prevKeyRef.current !== activeKey) {
      prevKeyRef.current = activeKey;
      setHiddenIds(new Set());
    }
  }, [activeKey]);

  useEffect(() => {
    const entries = Object.values(toolProgress);
    const completedNotHidden = entries.filter(
      (tp) => tp.status !== "running" && !hiddenIds.has(tp.toolUseId),
    );
    if (completedNotHidden.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        for (const tp of completedNotHidden) {
          next.add(tp.toolUseId);
        }
        return next;
      });
    }, COMPLETED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toolProgress, hiddenIds]);

  const visibleTools = Object.values(toolProgress).filter((tp) => !hiddenIds.has(tp.toolUseId));
  if (visibleTools.length === 0) {
    return null;
  }

  const runningCount = visibleTools.filter((tp) => tp.status === "running").length;

  return (
    <div className="mx-4 my-1 px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] mb-1">
        <Loader2 size={10} className={cn("shrink-0", runningCount > 0 && "animate-spin")} />
        <span>
          {runningCount > 0 ? t("toolsRunning", { count: runningCount }) : t("toolsCompleted")}
        </span>
      </div>
      <div className="space-y-0.5">
        {visibleTools.map((tool) => (
          <ToolEntry key={tool.toolUseId} tool={tool} />
        ))}
      </div>
    </div>
  );
}
