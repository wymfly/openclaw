import type { DeckGoPendingApproval } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function PendingList(props: {
  approvals: DeckGoPendingApproval[];
  selectedApprovalId: string;
  onSelect: (approvalId: string) => void;
}) {
  const t = useTranslations("approvals");

  if (props.approvals.length === 0) {
    return <p className="deckgo-note deck-ui-approvals-empty">{t("noPending")}</p>;
  }

  return (
    <ul className="deckgo-shell-list deck-ui-approvals-list">
      {props.approvals.map((approval) => (
        <li key={approval.id}>
          <button
            type="button"
            className={`deckgo-selectable-card deck-ui-approvals-row ${
              props.selectedApprovalId === approval.id ? "is-selected" : ""
            }`}
            onClick={() => props.onSelect(approval.id)}
          >
            <strong>{approval.command}</strong>
            <div className="deckgo-meta">
              {t("id")}: {approval.id} | {t("agent")}: {approval.agentId || t("notAvailable")} |{" "}
              {t("session")}: {approval.sessionKey || t("notAvailable")}
            </div>
            <div className="deckgo-meta">
              {t("expires")}: {new Date(approval.expiresAtMs).toLocaleString()}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
