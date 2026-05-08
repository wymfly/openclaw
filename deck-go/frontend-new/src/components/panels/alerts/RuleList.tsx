import type { DeckGoAlertRule } from "../../../api";
import { IconBolt, IconCheck } from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";

function formatCooldown(cooldownMs: number) {
  const minutes = Math.max(0, Math.round(cooldownMs / 60_000));
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  return `${minutes}m`;
}

function formatLastFired(value: string | null, never: string) {
  if (!value) {
    return never;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function RuleList(props: {
  rules: DeckGoAlertRule[];
  selectedRuleId: string | null;
  activeCriteria?: string;
  clearLabel?: string;
  loading: boolean;
  onCreate: () => void;
  onClearFilters?: () => void;
  onSelect: (rule: DeckGoAlertRule) => void;
  sourceCount: number;
  onToggleEnabled: (rule: DeckGoAlertRule) => void;
  onTestFire: (rule: DeckGoAlertRule) => void;
}) {
  const t = useTranslations("alerts");

  if (props.loading) {
    return <p className="alerts-panel__empty">{t("loadingRules")}</p>;
  }

  if (props.rules.length === 0) {
    const filteredEmpty = props.sourceCount > 0;
    return (
      <div className="alerts-panel__empty-state">
        <strong>{filteredEmpty ? t("noMatchingRules") : t("noRules")}</strong>
        <p>{filteredEmpty ? t("emptyFilterDescription") : t("emptyDescription")}</p>
        {props.activeCriteria ? <p>{props.activeCriteria}</p> : null}
        {filteredEmpty && props.clearLabel && props.onClearFilters ? (
          <button className="alerts-panel__button" type="button" onClick={props.onClearFilters}>
            {props.clearLabel}
          </button>
        ) : (
          <button
            className="alerts-panel__button is-primary"
            type="button"
            onClick={props.onCreate}
          >
            {t("addRule")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="alerts-panel__rule-table" role="list">
      <div className="alerts-panel__rule-header" aria-hidden="true">
        <span />
        <span>{t("ruleColumn")}</span>
        <span>{t("conditionColumn")}</span>
        <span>{t("thresholdColumn")}</span>
        <span>{t("actionColumn")}</span>
        <span>{t("cooldownColumn")}</span>
        <span>{t("lastFiredColumn")}</span>
        <span />
      </div>
      {props.rules.map((rule) => (
        <div
          aria-label={rule.name}
          aria-selected={props.selectedRuleId === rule.id}
          className={`alerts-panel__row ${props.selectedRuleId === rule.id ? "is-selected" : ""}`}
          key={rule.id}
          role="button"
          tabIndex={0}
          onClick={() => props.onSelect(rule)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              props.onSelect(rule);
            }
          }}
        >
          <span className="alerts-panel__entity-glyph" aria-hidden="true">
            {rule.entityType.slice(0, 2).toUpperCase()}
          </span>
          <span className="alerts-panel__row-main">
            <strong>{rule.name}</strong>
            <span>
              {rule.id} · {rule.entityType}
            </span>
          </span>
          <code className="alerts-panel__row-condition">{rule.condition}</code>
          <span className="alerts-panel__threshold-tag">{rule.threshold}</span>
          <span className={`alerts-panel__action-pill alerts-panel__action-pill--${rule.action}`}>
            {t(rule.action)}
          </span>
          <span className="alerts-panel__time-mono">{formatCooldown(rule.cooldownMs)}</span>
          <span className="alerts-panel__time-mono">
            {formatLastFired(rule.lastFiredAt, t("never"))}
          </span>
          <span className="alerts-panel__row-actions">
            <button
              aria-label={`${t("testFirePreview")} ${rule.name}`}
              className="alerts-panel__icon-btn"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                props.onTestFire(rule);
              }}
            >
              <IconBolt size={14} />
            </button>
            <button
              aria-label={`${rule.enabled ? t("disableRule") : t("enableRule")} ${rule.name}`}
              className={`alerts-panel__icon-btn ${rule.enabled ? "is-on" : ""}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                props.onToggleEnabled(rule);
              }}
            >
              <IconCheck size={14} />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
