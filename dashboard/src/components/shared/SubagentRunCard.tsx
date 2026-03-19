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
  onKill?: (sessionKey: string) => void;
  onViewSession?: (sessionKey: string) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  running: {
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
  const isRunning = run.status === "running";

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const startTime = new Date(run.startedAt).getTime();
    const update = () => setElapsed(Date.now() - startTime);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isRunning, run.startedAt]);

  const config = statusConfig[run.status] ?? statusConfig.running;

  return (
    <Card className="p-3 bg-[var(--bg-secondary)] border-[var(--border)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AgentBadge agentId={run.agentId} agentName={run.agentName} emoji={run.agentEmoji} />
          <Badge variant="outline" className={cn("text-[10px] border shrink-0", config.color)}>
            {config.label}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isRunning && (
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
      </div>

      {run.task && (
        <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-2">{run.task}</p>
      )}

      <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
        <span>depth: {run.depth}</span>
        {run.model && <span>model: {run.model}</span>}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {onViewSession && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] cursor-pointer"
            onClick={() => onViewSession(run.sessionKey)}
          >
            View Session
          </Button>
        )}
        {isRunning && onKill && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
            onClick={() => onKill(run.sessionKey)}
          >
            Terminate
          </Button>
        )}
      </div>
    </Card>
  );
}
