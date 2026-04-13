"use client";

import {
  AlertTriangle,
  BookOpen,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  Wrench,
  Copy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deckFetch } from "@/lib/deck-client";

interface DreamDiaryResult {
  agentId: string;
  found: boolean;
  path: string;
  content?: string;
  updatedAtMs?: number;
}

interface DreamActionResult {
  agentId: string;
  action: string;
  changed?: boolean;
  written?: number;
  replaced?: number;
  removedEntries?: number;
  dedupedEntries?: number;
  keptEntries?: number;
  scannedFiles?: number;
  warnings?: string[];
}

type DreamAction = "backfill" | "reset" | "resetShortTerm" | "repair" | "dedupe";

interface ActionDef {
  action: DreamAction;
  labelKey: string;
  descKey: string;
  icon: React.ReactNode;
  variant: "default" | "warning" | "destructive";
}

const ACTIONS: ActionDef[] = [
  {
    action: "backfill",
    labelKey: "dreams.actionBackfill",
    descKey: "dreams.actionBackfillDesc",
    icon: <Play size={12} />,
    variant: "default",
  },
  {
    action: "dedupe",
    labelKey: "dreams.actionDedupe",
    descKey: "dreams.actionDedupeDesc",
    icon: <Copy size={12} />,
    variant: "default",
  },
  {
    action: "repair",
    labelKey: "dreams.actionRepair",
    descKey: "dreams.actionRepairDesc",
    icon: <Wrench size={12} />,
    variant: "warning",
  },
  {
    action: "resetShortTerm",
    labelKey: "dreams.actionResetShortTerm",
    descKey: "dreams.actionResetShortTermDesc",
    icon: <RefreshCw size={12} />,
    variant: "warning",
  },
  {
    action: "reset",
    labelKey: "dreams.actionReset",
    descKey: "dreams.actionResetDesc",
    icon: <Trash2 size={12} />,
    variant: "destructive",
  },
];

const VARIANT_STYLE: Record<string, string> = {
  default: "text-[var(--primary)] hover:bg-[var(--primary-muted)] border-[var(--primary)]/20",
  warning:
    "text-[var(--warning-muted-text)] hover:bg-[var(--warning-muted)] border-[var(--warning)]/20",
  destructive:
    "text-[var(--destructive)] hover:bg-[var(--destructive-muted)] border-[var(--destructive)]/20",
};

export function DreamDiaryTab() {
  const t = useTranslations("memory");
  const [diary, setDiary] = useState<DreamDiaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<DreamAction | null>(null);
  const [actionResult, setActionResult] = useState<DreamActionResult | null>(null);
  const [confirmAction, setConfirmAction] = useState<DreamAction | null>(null);

  const fetchDiary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await deckFetch("/api/memory/dreams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Request failed" }))) as {
          error?: string;
        };
        setError(err.error ?? "Request failed");
        return;
      }
      const data = (await res.json()) as DreamDiaryResult;
      setDiary(data);
    } catch {
      setError("Failed to fetch dream diary");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDiary();
  }, [fetchDiary]);

  const handleAction = useCallback(
    async (action: DreamAction) => {
      // Require confirmation for warning/destructive actions
      const def = ACTIONS.find((a) => a.action === action);
      if (def && def.variant !== "default" && confirmAction !== action) {
        setConfirmAction(action);
        return;
      }
      setConfirmAction(null);
      setActionLoading(action);
      setActionResult(null);
      try {
        const res = await deckFetch("/api/memory/dreams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: "Action failed" }))) as {
            error?: string;
          };
          setError(err.error ?? "Action failed");
          return;
        }
        const data = (await res.json()) as DreamActionResult;
        setActionResult(data);
        // Refresh diary after action
        void fetchDiary();
      } catch {
        setError("Action failed");
      } finally {
        setActionLoading(null);
      }
    },
    [confirmAction, fetchDiary],
  );

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4">
      {/* Diary status card */}
      <Card className="bg-[var(--background)] border-[var(--border)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={16} className="text-[var(--primary)]" />
          <h3 className="text-xs font-semibold text-[var(--foreground)]">{t("dreams.title")}</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] ml-auto cursor-pointer"
            onClick={() => fetchDiary()}
            disabled={loading}
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        {loading && !diary && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
            <span className="text-xs text-[var(--muted-foreground)]">{t("dreams.loading")}</span>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-[var(--destructive-muted)] px-3 py-2 mb-3">
            <span className="text-xs text-[var(--destructive-muted-text)]">{error}</span>
          </div>
        )}

        {diary && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="text-[var(--muted-foreground)]">
                {t("dreams.agent")}:{" "}
                <span className="font-mono text-[var(--foreground)]">{diary.agentId}</span>
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] ${diary.found ? "bg-[var(--success-muted)] text-[var(--success)]" : "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]"}`}
              >
                {diary.found ? t("dreams.found") : t("dreams.notFound")}
              </Badge>
              {diary.updatedAtMs && (
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {t("dreams.updated")}: {new Date(diary.updatedAtMs).toLocaleString()}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-[var(--muted-foreground)]">{diary.path}</div>

            {/* Diary content preview */}
            {diary.content && (
              <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--muted)] p-3 max-h-48 overflow-y-auto">
                <pre className="text-[10px] text-[var(--foreground)] whitespace-pre-wrap font-mono leading-relaxed">
                  {diary.content}
                </pre>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Action result */}
      {actionResult && (
        <Card className="bg-[var(--primary-muted)] border-[var(--primary)]/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-[var(--primary)]">
              {t("dreams.actionComplete")}: {actionResult.action}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-[var(--foreground)]">
            {actionResult.changed !== undefined && (
              <span>
                {t("dreams.changed")}: {actionResult.changed ? t("dreams.yes") : t("dreams.no")}
              </span>
            )}
            {typeof actionResult.written === "number" && (
              <span>
                {t("dreams.written")}: {actionResult.written}
              </span>
            )}
            {typeof actionResult.removedEntries === "number" && (
              <span>
                {t("dreams.removed")}: {actionResult.removedEntries}
              </span>
            )}
            {typeof actionResult.dedupedEntries === "number" && (
              <span>
                {t("dreams.deduped")}: {actionResult.dedupedEntries}
              </span>
            )}
            {typeof actionResult.keptEntries === "number" && (
              <span>
                {t("dreams.kept")}: {actionResult.keptEntries}
              </span>
            )}
            {typeof actionResult.scannedFiles === "number" && (
              <span>
                {t("dreams.scanned")}: {actionResult.scannedFiles}
              </span>
            )}
          </div>
          {actionResult.warnings && actionResult.warnings.length > 0 && (
            <div className="mt-2 space-y-1">
              {actionResult.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-[10px] text-[var(--warning-muted-text)]"
                >
                  <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Action buttons */}
      <Card className="bg-[var(--background)] border-[var(--border)] p-4">
        <h3 className="text-xs font-semibold text-[var(--foreground)] mb-3">
          {t("dreams.actions")}
        </h3>
        <div className="space-y-2">
          {ACTIONS.map((def) => {
            const isActive = actionLoading === def.action;
            const isConfirming = confirmAction === def.action;
            return (
              <div
                key={def.action}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    {t(def.labelKey as "dreams.actionBackfill")}
                  </span>
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                    {t(def.descKey as "dreams.actionBackfillDesc")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-7 px-3 text-[10px] border cursor-pointer shrink-0 ${VARIANT_STYLE[def.variant]}`}
                  disabled={isActive}
                  onClick={() => handleAction(def.action)}
                  onBlur={() => {
                    if (isConfirming) {
                      setConfirmAction(null);
                    }
                  }}
                >
                  {isActive ? (
                    <Loader2 size={10} className="animate-spin mr-1" />
                  ) : (
                    <span className="mr-1">{def.icon}</span>
                  )}
                  {isConfirming ? t("dreams.confirm") : t(def.labelKey as "dreams.actionBackfill")}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
