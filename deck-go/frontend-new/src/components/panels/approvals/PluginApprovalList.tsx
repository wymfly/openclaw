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
    return <p className="approvals-panel__note">{t("pluginNoPending")}</p>;
  }

  return (
    <ul className="approvals-panel__list">
      {props.approvals.map((approval) => {
        const expired = isPluginApprovalExpired(approval);
        return (
          <li key={approval.id}>
            <button
              type="button"
              className={`approvals-panel__row ${
                props.selectedApprovalId === approval.id ? "is-selected" : ""
              }`}
              onClick={() => props.onSelect(approval.id)}
            >
              <div>
                <strong>{approval.pluginId || approval.id}</strong>
                <p className="approvals-panel__meta">
                  {t("id")}: {approval.id} | {t("status")}: {approval.status || t("pendingBadge")} |{" "}
                  {t("decision")}:{" "}
                  {approval.decision || (expired ? t("pluginExpired") : t("pendingBadge"))}
                </p>
                <p className="approvals-panel__meta">
                  {t("command")}: {approval.command || t("notAvailable")} | {t("expires")}:{" "}
                  {formatOptionalDate(approval.expiresAtMs, t("notAvailable"))}
                </p>
              </div>
              <span
                className={`approvals-panel__pill ${
                  approval.decision ? "is-good" : expired ? "is-danger" : "is-warn"
                }`}
              >
                {approval.decision || (expired ? t("pluginExpired") : t("pendingBadge"))}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
