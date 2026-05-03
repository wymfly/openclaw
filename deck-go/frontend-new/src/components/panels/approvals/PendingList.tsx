import type { DeckGoPendingApproval } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function PendingList(props: {
  approvals: DeckGoPendingApproval[];
  selectedApprovalId: string;
  onSelect: (approvalId: string) => void;
}) {
  const t = useTranslations("approvals");

  if (props.approvals.length === 0) {
    return <p className="approvals-panel__note">{t("noPending")}</p>;
  }

  return (
    <ul className="approvals-panel__list">
      {props.approvals.map((approval) => (
        <li key={approval.id}>
          <button
            type="button"
            className={`approvals-panel__row ${
              props.selectedApprovalId === approval.id ? "is-selected" : ""
            }`}
            onClick={() => props.onSelect(approval.id)}
          >
            <div>
              <strong>{approval.command}</strong>
              <p className="approvals-panel__meta">
                {t("id")}: {approval.id} | {t("agent")}: {approval.agentId || t("notAvailable")} |{" "}
                {t("session")}: {approval.sessionKey || t("notAvailable")}
              </p>
              <p className="approvals-panel__meta">
                {t("run")}: {approval.runId || t("notAvailable")} | {t("expires")}:{" "}
                {new Date(approval.expiresAtMs).toLocaleString()}
              </p>
            </div>
            <span className="approvals-panel__pill is-warn">{t("pendingBadge")}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
