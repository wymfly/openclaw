"use client";

import { Shield, Check, X, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ApprovalRequest } from "@/stores/chat-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalDialogProps {
  approval: ApprovalRequest;
  onResolve: (id: string, decision: "allow-once" | "allow-always" | "deny") => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Inline approval dialog shown above MessageInput when the agent requests
 * permission to execute a tool (e.g. a bash command).
 *
 * The card uses a warning-tinted ring so it visually stands out from the
 * normal chat flow. Three buttons map to the three possible decisions.
 */
export function ApprovalDialog({ approval, onResolve }: ApprovalDialogProps) {
  const t = useTranslations("chat");

  return (
    <div className="mx-4 my-2 p-4 rounded-xl bg-[var(--muted)] ring-1 ring-[var(--warning)]/30 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
        <Shield size={16} className="text-[var(--warning)] shrink-0" />
        <span>{t("approvalTitle")}</span>
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

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => onResolve(approval.id, "allow-once")}
        >
          <Check size={12} />
          {t("approvalAllow")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => onResolve(approval.id, "allow-always")}
        >
          <ShieldCheck size={12} />
          {t("approvalAllowAlways")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5 text-xs"
          onClick={() => onResolve(approval.id, "deny")}
        >
          <X size={12} />
          {t("approvalDeny")}
        </Button>
      </div>
    </div>
  );
}
