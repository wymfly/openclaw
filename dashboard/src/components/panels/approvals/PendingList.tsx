"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApprovalsStore, type ApprovalDecision } from "@/stores/approvals";

export function PendingList() {
  const t = useTranslations("approvals");
  const pending = useApprovalsStore((s) => s.pending);
  const resolveApproval = useApprovalsStore((s) => s.resolveApproval);

  const handleResolve = (id: string, decision: ApprovalDecision) => {
    void resolveApproval(id, decision);
  };

  if (pending.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-3 text-[var(--text-secondary)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
          <ShieldCheck size={20} className="text-[var(--accent)]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">{t("noPending")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {pending.map((item) => (
        <Card key={item.id} size="sm" className="card-hover">
          <CardContent>
            {/* Command + details */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge
                  variant="secondary"
                  className="bg-[var(--warning-muted)] text-[var(--warning-muted-text)]"
                >
                  {t("command")}
                </Badge>
                <code className="text-sm font-mono truncate text-[var(--text-primary)]">
                  {item.command}
                </code>
              </div>

              <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                {item.agentId && (
                  <span>
                    {t("agent")}: <span className="font-mono">{item.agentId}</span>
                  </span>
                )}
                <span>
                  {t("requestedAt")}:{" "}
                  <span className="font-mono">
                    {new Date(item.createdAtMs).toLocaleTimeString()}
                  </span>
                </span>
                <span>
                  {t("expiresAt")}:{" "}
                  <span className="font-mono">
                    {new Date(item.expiresAtMs).toLocaleTimeString()}
                  </span>
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                className="border-[var(--success)]/50 text-[var(--success-muted-text)] hover:bg-[var(--success-muted)]"
                onClick={() => handleResolve(item.id, "allow-once")}
              >
                {t("approve")}
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent-muted)]"
                onClick={() => handleResolve(item.id, "allow-always")}
              >
                {t("approveAlways")}
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="border-[var(--danger)]/50 text-[var(--danger)] hover:bg-[var(--danger-muted)]"
                onClick={() => handleResolve(item.id, "deny")}
              >
                {t("deny")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
