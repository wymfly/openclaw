"use client";

import {
  ChevronRight,
  Clock,
  GitBranch,
  History,
  Loader2,
  RotateCcw,
  Minimize2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { deckFetch } from "@/lib/deck-client";
import { cn } from "@/lib/utils";

interface CompactionHistoryProps {
  sessionKey: string;
  compactionCount?: number;
}

interface CompactionCheckpoint {
  checkpointId: string;
  sessionKey: string;
  sessionId: string;
  createdAt: number;
  reason: "manual" | "auto-threshold" | "overflow-retry" | "timeout-retry";
  tokensBefore?: number;
  tokensAfter?: number;
  summary?: string;
}

interface CompactionListResult {
  ok: boolean;
  key: string;
  checkpoints: CompactionCheckpoint[];
}

const REASON_BADGE: Record<string, string> = {
  manual: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "auto-threshold": "bg-[var(--primary-muted)] text-[var(--primary)]",
  "overflow-retry": "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]",
  "timeout-retry": "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

function formatTime(ts: number): string {
  if (!ts) {
    return "";
  }
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CompactionHistory({ sessionKey, compactionCount }: CompactionHistoryProps) {
  const t = useTranslations("sessions");
  const [open, setOpen] = useState(false);
  const [checkpoints, setCheckpoints] = useState<CompactionCheckpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchCheckpoints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await deckFetch("/api/chat/compaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", key: sessionKey }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Request failed" }))) as {
          error?: string;
        };
        setError(err.error ?? t("compaction.fetchFailed"));
        return;
      }
      const data = (await res.json()) as CompactionListResult;
      setCheckpoints(data.checkpoints ?? []);
      setLoaded(true);
    } catch {
      setError(t("compaction.fetchFailed"));
    } finally {
      setLoading(false);
    }
  }, [sessionKey]);

  useEffect(() => {
    if (open && !loaded) {
      void fetchCheckpoints();
    }
  }, [open, loaded, fetchCheckpoints]);

  // Reset when session changes
  useEffect(() => {
    setLoaded(false);
    setCheckpoints([]);
    setOpen(false);
  }, [sessionKey]);

  const handleAction = useCallback(
    async (action: "branch" | "restore", checkpointId: string) => {
      setActionLoading(checkpointId);
      setActionResult(null);
      try {
        const res = await deckFetch("/api/chat/compaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, key: sessionKey, checkpointId }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: "Action failed" }))) as {
            error?: string;
          };
          setActionResult(err.error ?? t("compaction.actionFailed"));
          return;
        }
        const data = (await res.json()) as { ok: boolean; key?: string };
        if (action === "branch") {
          setActionResult(t("compaction.branchCreated", { key: data.key ?? "" }));
        } else {
          setActionResult(t("compaction.restored"));
          // Re-fetch checkpoints after restore
          void fetchCheckpoints();
        }
      } catch {
        setActionResult(t("compaction.actionFailed"));
      } finally {
        setActionLoading(null);
      }
    },
    [sessionKey, fetchCheckpoints, t],
  );

  // Don't render if no compactions
  if (!compactionCount || compactionCount === 0) {
    return null;
  }

  return (
    <div className="border-b border-[var(--border)] shrink-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <CollapsibleTrigger
            render={<span className="flex-1 flex items-center gap-2 text-left cursor-pointer" />}
          >
            <History size={14} className="text-[var(--primary)]" />
            <span className="text-xs font-medium text-[var(--foreground)]">
              {t("compaction.title")}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] border-[var(--border)] text-[var(--muted-foreground)]"
            >
              {compactionCount}
            </Badge>
            <ChevronRight
              size={14}
              className={cn(
                "text-[var(--muted-foreground)] transition-transform duration-150 shrink-0",
                open && "rotate-90",
              )}
            />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-2">
            {loading && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t("compaction.loading")}
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-[var(--destructive-muted)] px-3 py-2">
                <span className="text-xs text-[var(--destructive-muted-text)]">{error}</span>
              </div>
            )}

            {actionResult && (
              <div className="rounded-md bg-[var(--primary-muted)] px-3 py-2">
                <span className="text-xs text-[var(--primary)]">{actionResult}</span>
              </div>
            )}

            {!loading && checkpoints.length === 0 && loaded && (
              <div className="py-4 text-center text-xs text-[var(--muted-foreground)]">
                {t("compaction.noCheckpoints")}
              </div>
            )}

            {checkpoints.map((cp, i) => {
              const saved =
                typeof cp.tokensBefore === "number" && typeof cp.tokensAfter === "number"
                  ? cp.tokensBefore - cp.tokensAfter
                  : null;
              const isActing = actionLoading === cp.checkpointId;
              return (
                <div
                  key={cp.checkpointId}
                  className="relative pl-5 pb-2 border-l-2 border-[var(--border-subtle)] last:border-transparent"
                >
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "absolute -left-[5px] top-1 w-2 h-2 rounded-full",
                      i === 0 ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]",
                    )}
                  />

                  <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Clock size={11} className="text-[var(--muted-foreground)]" />
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {formatTime(cp.createdAt)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] border ${REASON_BADGE[cp.reason] ?? ""}`}
                      >
                        {t(`compaction.reason_${cp.reason}` as "compaction.reason_manual")}
                      </Badge>
                      {saved && saved > 0 && (
                        <span className="text-[10px] text-[var(--success)]">
                          <Minimize2 size={10} className="inline mr-0.5" />
                          {t("compaction.saved", { tokens: formatTokens(saved) })}
                        </span>
                      )}
                    </div>

                    {/* Token stats */}
                    {typeof cp.tokensBefore === "number" && typeof cp.tokensAfter === "number" && (
                      <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)] mb-1.5">
                        <span>
                          {t("compaction.before")}: {formatTokens(cp.tokensBefore)}
                        </span>
                        <span>→</span>
                        <span>
                          {t("compaction.after")}: {formatTokens(cp.tokensAfter)}
                        </span>
                      </div>
                    )}

                    {/* Summary */}
                    {cp.summary && (
                      <p className="text-[10px] text-[var(--muted-foreground)] line-clamp-3 mb-2">
                        {cp.summary}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-[var(--primary)] hover:bg-[var(--primary-muted)] cursor-pointer"
                        disabled={isActing}
                        onClick={() => handleAction("branch", cp.checkpointId)}
                      >
                        {isActing ? (
                          <Loader2 size={10} className="animate-spin mr-1" />
                        ) : (
                          <GitBranch size={10} className="mr-1" />
                        )}
                        {t("compaction.branch")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-[var(--warning-muted-text)] hover:bg-[var(--warning-muted)] cursor-pointer"
                        disabled={isActing}
                        onClick={() => handleAction("restore", cp.checkpointId)}
                      >
                        <RotateCcw size={10} className="mr-1" />
                        {t("compaction.restore")}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
