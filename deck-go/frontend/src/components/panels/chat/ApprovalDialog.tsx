import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ApprovalDecision } from "@/stores/approvals";
import type { ApprovalRequest } from "@/stores/chat-types";

export type ApprovalDialogProps = {
  approval: ApprovalRequest;
  pendingCount?: number;
  onResolve: (id: string, decision: ApprovalDecision) => void | Promise<void>;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) {
    return "0s";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function ApprovalDialog({ approval, pendingCount, onResolve }: ApprovalDialogProps) {
  const t = useTranslations("approvals");
  const [resolving, setResolving] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!approval.expiresAtMs) {
      setRemaining(null);
      return undefined;
    }
    const update = () => setRemaining(Math.max(0, approval.expiresAtMs! - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [approval.expiresAtMs]);

  useEffect(() => {
    setResolving(false);
  }, [approval.id]);

  const handleResolve = async (decision: ApprovalDecision) => {
    setResolving(true);
    try {
      await onResolve(approval.id, decision);
    } catch {
      setResolving(false);
    }
  };

  return (
    <section aria-label={t("inlineTitle")} className="deck-ui-approval-dialog">
      <header>
        <strong>{t("inlineTitle")}</strong>
        {remaining != null ? <span>{formatCountdown(remaining)}</span> : null}
        {pendingCount != null && pendingCount > 1 ? (
          <span>
            {pendingCount} {t("pendingBadge")}
          </span>
        ) : null}
      </header>

      <div className="deck-ui-approval-body">
        <code>{approval.toolName}</code>
        {approval.command ? <pre>{approval.command}</pre> : null}
        {approval.description && !approval.command ? <p>{approval.description}</p> : null}
      </div>

      {approval.agentId || approval.cwd ? (
        <dl>
          {approval.agentId ? (
            <>
              <dt>{t("agent")}</dt>
              <dd>{approval.agentId}</dd>
            </>
          ) : null}
          {approval.cwd ? (
            <>
              <dt>cwd</dt>
              <dd>{approval.cwd}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      <div className="deck-ui-approval-actions">
        <button
          className="deck-ui-approval-allow"
          type="button"
          disabled={resolving}
          onClick={() => void handleResolve("allow-once")}
        >
          {t("approve")}
        </button>
        <button
          className="deck-ui-approval-allow"
          type="button"
          disabled={resolving}
          onClick={() => void handleResolve("allow-always")}
        >
          {t("approveAlways")}
        </button>
        <button
          className="deck-ui-approval-deny"
          type="button"
          disabled={resolving}
          onClick={() => void handleResolve("deny")}
        >
          {t("deny")}
        </button>
      </div>
    </section>
  );
}
