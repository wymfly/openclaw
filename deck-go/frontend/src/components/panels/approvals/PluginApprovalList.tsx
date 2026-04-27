import type { DeckGoPluginApprovalEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { formatOptionalDate, isPluginApprovalExpired } from "./approval-model";

export function PluginApprovalList(props: {
  approvals: DeckGoPluginApprovalEntry[];
  selectedApprovalId: string;
  onSelect: (approvalId: string) => void;
}) {
  const t = useTranslations("approvals");

  if (props.approvals.length === 0) {
    return <p className="deckgo-note deck-ui-approvals-empty">{t("pluginNoPending")}</p>;
  }

  return (
    <ul className="deckgo-shell-list deck-ui-approvals-list">
      {props.approvals.map((approval) => {
        const expired = isPluginApprovalExpired(approval);
        return (
          <li key={approval.id}>
            <button
              type="button"
              className={`deckgo-selectable-card deck-ui-approvals-row ${
                props.selectedApprovalId === approval.id ? "is-selected" : ""
              }`}
              onClick={() => props.onSelect(approval.id)}
            >
              <strong>{approval.pluginId || approval.id}</strong>
              <div className="deckgo-meta">
                {t("id")}: {approval.id} | {t("status")}: {approval.status || t("pendingBadge")} |{" "}
                {t("decision")}:{" "}
                {approval.decision || (expired ? t("pluginExpired") : t("pendingBadge"))}
              </div>
              <div className="deckgo-meta">
                {t("command")}: {approval.command || t("notAvailable")} | {t("expires")}:{" "}
                {formatOptionalDate(approval.expiresAtMs, t("notAvailable"))}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
