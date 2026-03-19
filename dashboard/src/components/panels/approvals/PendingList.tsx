"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApprovalsStore, type ApprovalDecision } from "@/stores/approvals";

/**
 * PendingList — shows pending approvals with resolve actions.
 *
 * Each item displays: command, agent, timestamp.
 * Three action buttons: Approve (allow-once), Always Approve (allow-always), Deny.
 */
export function PendingList() {
  const t = useTranslations("approvals");
  const pending = useApprovalsStore((s) => s.pending);
  const resolveApproval = useApprovalsStore((s) => s.resolveApproval);

  const handleResolve = (id: string, decision: ApprovalDecision) => {
    void resolveApproval(id, decision);
  };

  if (pending.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <span className="text-sm text-muted-foreground">{t("noPending")}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {pending.map((item) => (
        <Card key={item.id} size="sm">
          <CardContent>
            {/* Command + details */}
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="secondary"
                  className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                >
                  {t("command")}
                </Badge>
                <code className="text-sm font-mono truncate text-foreground">{item.command}</code>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {item.agentId && (
                  <span>
                    {t("agent")}: {item.agentId}
                  </span>
                )}
                <span>
                  {t("requestedAt")}: {new Date(item.createdAtMs).toLocaleTimeString()}
                </span>
                <span>
                  {t("expiresAt")}: {new Date(item.expiresAtMs).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                className="border-green-500/50 text-green-600 dark:text-green-400 hover:bg-green-500/10"
                onClick={() => handleResolve(item.id, "allow-once")}
              >
                {t("approve")}
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="border-primary/50 text-primary hover:bg-primary/10"
                onClick={() => handleResolve(item.id, "allow-always")}
              >
                {t("approveAlways")}
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
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
