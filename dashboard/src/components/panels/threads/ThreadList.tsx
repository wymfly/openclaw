"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { AgentBadge } from "@/components/shared/AgentBadge";
import { useThreadsStore, type ThreadEntry } from "@/stores/deck-threads";

// ---------------------------------------------------------------------------
// Relative-time helper (i18n-aware)
// ---------------------------------------------------------------------------

function relativeTime(
  ts: number,
  // next-intl Translator generic is not directly assignable to plain function type
  t: (key: string, values?: Record<string, number>) => string,
): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 0) {
    return t("justNow");
  }

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) {
    return t("secondsAgo", { n: seconds });
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return t("minutesAgo", { n: minutes });
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t("hoursAgo", { n: hours });
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return t("daysAgo", { n: days });
  }

  return new Date(ts).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// ThreadList
// ---------------------------------------------------------------------------

export function ThreadList() {
  const t = useTranslations("threads");
  const tc = useTranslations("common");
  const { threads, loading } = useThreadsStore();

  const sorted = useMemo(
    () => [...threads].toSorted((a, b) => b.lastActivityAt - a.lastActivityAt),
    [threads],
  );

  if (loading && threads.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        {tc("loading")}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        {t("noThreads")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column headers */}
      <div
        className="grid grid-cols-6 gap-2 px-3 py-2 text-xs font-semibold border-b shrink-0"
        style={{
          borderColor: "var(--border)",
          color: "var(--muted-foreground)",
          backgroundColor: "var(--muted)",
        }}
      >
        <span>{t("channel")}</span>
        <span>{t("agent")}</span>
        <span>{t("threadId")}</span>
        <span>{t("kind")}</span>
        <span>{t("boundAt")}</span>
        <span>{t("lastActivity")}</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((thread: ThreadEntry) => (
          <div
            key={thread.threadId}
            className="grid grid-cols-6 gap-2 px-3 py-2 text-xs border-b transition-colors"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--foreground)",
            }}
          >
            {/* Channel */}
            <span className="truncate" title={thread.channelId}>
              {thread.channelId}
            </span>

            {/* Agent */}
            <span className="min-w-0">
              <AgentBadge agentId={thread.agentId} />
            </span>

            {/* Label / threadId */}
            <span className="truncate" title={thread.threadId}>
              {thread.label || thread.threadId}
            </span>

            {/* Kind */}
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium w-fit"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              {thread.targetKind}
            </span>

            {/* Bound at */}
            <span style={{ color: "var(--text-tertiary)" }}>{relativeTime(thread.boundAt, t)}</span>

            {/* Last activity */}
            <span style={{ color: "var(--text-tertiary)" }}>
              {relativeTime(thread.lastActivityAt, t)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
