import type { DeckGoAlertRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

function formatCooldown(cooldownMs: number) {
  return Math.round(cooldownMs / 60_000);
}

export function RuleList(props: {
  rules: DeckGoAlertRule[];
  selectedRuleId: string | null;
  onSelect: (rule: DeckGoAlertRule) => void;
}) {
  const t = useTranslations("alerts");

  if (props.rules.length === 0) {
    return <p className="alerts-panel__empty">{t("noRules")}</p>;
  }

  return (
    <div className="alerts-panel__catalog">
      {props.rules.map((rule) => (
        <button
          className={`alerts-panel__row ${props.selectedRuleId === rule.id ? "is-selected" : ""}`}
          key={rule.id}
          type="button"
          aria-pressed={props.selectedRuleId === rule.id}
          onClick={() => props.onSelect(rule)}
        >
          <span className="alerts-panel__row-head">
            <strong>{rule.name}</strong>
            <span className="alerts-panel__pill-row">
              <span className={`alerts-panel__pill ${rule.enabled ? "is-positive" : "is-muted"}`}>
                {rule.enabled ? t("enabled") : t("disabled")}
              </span>
              <span className="alerts-panel__pill">{t(rule.action)}</span>
            </span>
          </span>
          <span className="alerts-panel__meta">
            {rule.entityType} · {rule.condition} {rule.threshold}
          </span>
          <span className="alerts-panel__meta">
            {t("cooldown")}: {formatCooldown(rule.cooldownMs)} {t("cooldownMinutes")} ·{" "}
            {t("lastFired")}: {rule.lastFiredAt ?? t("never")}
          </span>
        </button>
      ))}
    </div>
  );
}
