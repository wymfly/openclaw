"use client";

import { Bot, Minimize2, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useUsageStore, type SessionLogEntry } from "@/stores/usage";

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString();
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

function TurnEntry({ entry, isHighCost }: { entry: SessionLogEntry; isHighCost: boolean }) {
  const t = useTranslations("sessions");
  const isCompaction = entry.role === "compactionSummary";
  const isUser = entry.role === "user";
  const preview = entry.content.length > 80 ? `${entry.content.slice(0, 77)}…` : entry.content;

  return (
    <div
      className={cn(
        "relative pl-6 pb-4",
        // Timeline connector line
        "before:absolute before:left-[9px] before:top-4 before:bottom-0 before:w-px before:bg-[var(--border)]",
      )}
    >
      {/* Dot */}
      <div
        className={cn(
          "absolute left-1 top-1 w-[14px] h-[14px] rounded-full flex items-center justify-center ring-1",
          isCompaction
            ? "bg-[var(--warning-muted)] text-[var(--warning)] ring-[var(--warning)]/20"
            : isUser
              ? "bg-[var(--primary-muted)] text-[var(--primary)] ring-[var(--primary)]/20"
              : "bg-[var(--muted)] text-[var(--muted-foreground)] ring-[var(--border)]",
        )}
      >
        {isCompaction ? <Minimize2 size={8} /> : isUser ? <User size={8} /> : <Bot size={8} />}
      </div>

      {/* Content card */}
      <div
        className={cn(
          "rounded-md px-2.5 py-1.5 text-xs",
          isHighCost && !isCompaction && "bg-[var(--warning-muted)]",
          isCompaction && "bg-[var(--warning-muted)]",
          !isHighCost && !isCompaction && "bg-[var(--muted)]/50",
        )}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
            {formatTs(entry.timestamp)}
          </span>
          <span className="text-[10px] font-semibold text-[var(--muted-foreground)] capitalize">
            {isCompaction ? t("timeline.compactionEvent") : entry.role}
          </span>
          {typeof entry.tokens === "number" && entry.tokens > 0 && (
            <span
              className={cn(
                "text-[10px] font-mono font-semibold px-1 rounded",
                isHighCost
                  ? "text-[var(--warning)] bg-[var(--warning)]/10"
                  : "text-[var(--muted-foreground)]",
              )}
            >
              {formatTokens(entry.tokens)}
            </span>
          )}
          {typeof entry.cost === "number" && entry.cost > 0 && (
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
              ${entry.cost.toFixed(4)}
            </span>
          )}
        </div>
        {preview && (
          <p className="text-[var(--foreground)] leading-relaxed break-words">{preview}</p>
        )}
      </div>
    </div>
  );
}

export function TurnTimeline({ sessionKey }: { sessionKey: string }) {
  const t = useTranslations("sessions");
  const logs = useUsageStore((s) => s.usageLogs[sessionKey]);
  const loading = useUsageStore((s) => s.usageLogsLoading);
  const error = useUsageStore((s) => s.usageLogsError);
  const fetchUsageLogs = useUsageStore((s) => s.fetchUsageLogs);

  useEffect(() => {
    if (!logs) {
      void fetchUsageLogs(sessionKey);
    }
  }, [sessionKey, logs, fetchUsageLogs]);

  if (loading && !logs) {
    return (
      <p className="text-xs text-[var(--muted-foreground)] px-4 py-6 text-center">
        {t("timeline.loading")}
      </p>
    );
  }

  if (error && !logs) {
    return (
      <p className="text-xs text-[var(--destructive)] px-4 py-6 text-center">
        {t("timeline.error")}
      </p>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <p className="text-xs text-[var(--muted-foreground)] px-4 py-6 text-center">
        {t("timeline.empty")}
      </p>
    );
  }

  // Calculate average tokens for high-cost detection (> 2x average)
  const tokenValues = logs.map((e) => e.tokens ?? 0).filter((t) => t > 0);
  const avgTokens =
    tokenValues.length > 0 ? tokenValues.reduce((a, b) => a + b, 0) / tokenValues.length : 0;

  return (
    <div className="py-2">
      {logs.map((entry, i) => (
        <TurnEntry
          key={`${entry.timestamp}-${i}`}
          entry={entry}
          isHighCost={
            typeof entry.tokens === "number" && avgTokens > 0 && entry.tokens > avgTokens * 2
          }
        />
      ))}
    </div>
  );
}
