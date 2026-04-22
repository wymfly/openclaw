"use client";

import { Shield, Check, X, ShieldCheck, Clock, User, FolderOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ApprovalRequest } from "@/stores/chat-types";

interface ApprovalDialogProps {
  approval: ApprovalRequest;
  pendingCount?: number;
  onResolve: (id: string, decision: "allow-once" | "allow-always" | "deny") => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) {
    return "0s";
  }
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ApprovalDialog({ approval, pendingCount, onResolve }: ApprovalDialogProps) {
  const t = useTranslations("approvals");
  const [resolving, setResolving] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!approval.expiresAtMs) {
      setRemaining(null);
      return;
    }
    const update = () => setRemaining(Math.max(0, approval.expiresAtMs! - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [approval.expiresAtMs]);

  // Reset resolving state when approval changes (new approval replaces resolved one)
  useEffect(() => {
    setResolving(false);
  }, [approval.id]);

  const handleResolve = async (decision: "allow-once" | "allow-always" | "deny") => {
    setResolving(true);
    try {
      onResolve(approval.id, decision);
    } catch {
      setResolving(false);
    }
  };

  return (
    <div className="mx-4 my-2 p-4 rounded-xl bg-[var(--muted)] ring-1 ring-[var(--warning)]/30 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
        <Shield size={16} className="text-[var(--warning)] shrink-0" />
        <span>{t("inlineTitle")}</span>
        {/* Countdown */}
        {remaining != null && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-[var(--muted-foreground)]">
            <Clock size={10} />
            {formatCountdown(remaining)}
          </span>
        )}
        {/* Queue badge */}
        {pendingCount != null && pendingCount > 1 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">
            {pendingCount} {t("pendingBadge")}
          </span>
        )}
      </div>

      {/* Tool info */}
      <div className="text-xs text-[var(--muted-foreground)] space-y-1.5">
        <code className="font-mono text-[var(--primary)]">{approval.toolName}</code>
        {approval.command && (
          <pre className="mt-1.5 p-2 rounded-lg bg-[var(--background)] text-[var(--foreground)] overflow-auto max-h-[120px] text-xs leading-relaxed whitespace-pre-wrap break-words">
            {approval.command}
          </pre>
        )}
        {approval.description && !approval.command && (
          <p className="text-[var(--muted-foreground)]">{approval.description}</p>
        )}
      </div>

      {/* Metadata row */}
      {(approval.agentId || approval.cwd) && (
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-[var(--text-tertiary)]">
          {approval.agentId && (
            <span className="flex items-center gap-1">
              <User size={10} />
              {approval.agentId}
            </span>
          )}
          {approval.cwd && (
            <span className="flex items-center gap-1">
              <FolderOpen size={10} />
              {approval.cwd}
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={resolving}
          onClick={() => void handleResolve("allow-once")}
        >
          <Check size={12} />
          {t("approve")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={resolving}
          onClick={() => void handleResolve("allow-always")}
        >
          <ShieldCheck size={12} />
          {t("approveAlways")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5 text-xs"
          disabled={resolving}
          onClick={() => void handleResolve("deny")}
        >
          <X size={12} />
          {t("deny")}
        </Button>
      </div>
    </div>
  );
}
