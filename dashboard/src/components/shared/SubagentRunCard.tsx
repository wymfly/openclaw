"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SubagentRun } from "@/stores/deck-subagents";
import { AgentBadge } from "./AgentBadge";

interface SubagentRunCardProps {
  run: SubagentRun;
  onKill?: (runId: string) => void;
  onViewSession?: (sessionKey: string) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  active: {
    label: "Running",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    icon: "spinner",
  },
  completed: {
    label: "Done",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    icon: "check",
  },
  failed: { label: "Failed", color: "bg-red-500/15 text-red-400 border-red-500/25", icon: "x" },
  timeout: {
    label: "Timeout",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    icon: "clock",
  },
};

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  return `${minutes}m ${remainSec}s`;
}

/** Card displaying a single subagent run with live elapsed time. */
export function SubagentRunCard({ run, onKill, onViewSession }: SubagentRunCardProps) {
  const [elapsed, setElapsed] = useState<number>(0);
  const isActive = run.status === "active";

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const startTime = run.startedAt ?? run.createdAt;
    const update = () => setElapsed(Date.now() - startTime);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isActive, run.startedAt, run.createdAt]);

  const config = statusConfig[run.status] ?? statusConfig.active;

  return (
    <Card className="p-3 bg-[var(--card)] border-[var(--border)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AgentBadge agentId={run.childAgentId} agentName={run.childAgentName} />
          <Badge variant="outline" className={cn("text-[10px] border shrink-0", config.color)}>
            {config.label}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isActive && (
            <span className="text-xs font-mono text-[var(--muted-foreground)]">
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
      </div>

      {run.task && (
        <p className="mt-2 text-xs text-[var(--muted-foreground)] line-clamp-2">{run.task}</p>
      )}

      <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
        <span>depth: {run.depth}</span>
        {run.model && <span>model: {run.model}</span>}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {onViewSession && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] cursor-pointer"
            onClick={() => onViewSession(run.childSessionKey)}
          >
            View Session
          </Button>
        )}
        {isActive && onKill && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
            onClick={() => onKill(run.runId)}
          >
            Terminate
          </Button>
        )}
      </div>
    </Card>
  );
}
