import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  BotIcon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  ShieldCheckIcon,
  XIcon,
} from "@/deck-ui/icons";
import { Badge } from "@/design-system/atoms/Badge";
import { Button } from "@/design-system/atoms/Button";
import { Card } from "@/design-system/atoms/Card";
import type { ApprovalDecision } from "@/stores/approvals";
import type { ApprovalRequest } from "@/stores/chat-types";
import "./approval-dialog.css";

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
    <Card
      surface="elev"
      padded={false}
      role="region"
      aria-label={t("inlineTitle")}
      className="ds-approval-dialog deck-ui-approval-dialog"
    >
      <header className="ds-approval-dialog__header">
        <ShieldCheckIcon className="ds-approval-dialog__icon deck-ui-approval-icon" />
        <strong>{t("inlineTitle")}</strong>
        {remaining != null ? (
          <span className="ds-approval-dialog__countdown deck-ui-approval-countdown">
            <ClockIcon />
            {formatCountdown(remaining)}
          </span>
        ) : null}
        {pendingCount != null && pendingCount > 1 ? (
          <Badge variant="warn">
            {pendingCount} {t("pendingBadge")}
          </Badge>
        ) : null}
      </header>

      <div className="ds-approval-dialog__body deck-ui-approval-body">
        <code>{approval.toolName}</code>
        {approval.command ? <pre>{approval.command}</pre> : null}
        {approval.description && !approval.command ? <p>{approval.description}</p> : null}
      </div>

      {approval.agentId || approval.cwd ? (
        <dl className="ds-approval-dialog__meta">
          {approval.agentId ? (
            <>
              <dt>{t("agent")}</dt>
              <dd>
                <BotIcon />
                {approval.agentId}
              </dd>
            </>
          ) : null}
          {approval.cwd ? (
            <>
              <dt>cwd</dt>
              <dd>
                <FileTextIcon />
                {approval.cwd}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}

      <div className="ds-approval-dialog__actions deck-ui-approval-actions">
        <Button
          variant="primary"
          size="sm"
          className="deck-ui-approval-allow"
          disabled={resolving}
          onClick={() => void handleResolve("allow-once")}
        >
          <CheckIcon />
          {t("approve")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="deck-ui-approval-allow"
          disabled={resolving}
          onClick={() => void handleResolve("allow-always")}
        >
          <ShieldCheckIcon />
          {t("approveAlways")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="deck-ui-approval-deny"
          disabled={resolving}
          onClick={() => void handleResolve("deny")}
        >
          <XIcon />
          {t("deny")}
        </Button>
      </div>
    </Card>
  );
}
