import { useState, type FormEvent } from "react";
import type { DeckGoAlertAction, DeckGoAlertRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

type RuleDraft = {
  name: string;
  entityType: string;
  condition: string;
  threshold: string;
  action: DeckGoAlertAction;
  cooldownMinutes: string;
  enabled: boolean;
};

export type AlertRuleInput = Omit<
  DeckGoAlertRule,
  "id" | "lastFiredAt" | "createdAt" | "updatedAt"
>;

const ACTIONS: DeckGoAlertAction[] = ["toast", "activity", "webhook"];
const COOLDOWN_PRESETS = [1, 5, 10, 30, 60, 240, 1440];

function draftFromRule(rule: DeckGoAlertRule | undefined, fallbackEntity: string): RuleDraft {
  return {
    name: rule?.name ?? "",
    entityType: rule?.entityType ?? fallbackEntity,
    condition: rule?.condition ?? "",
    threshold: rule ? String(rule.threshold) : "0",
    action: rule?.action ?? "toast",
    cooldownMinutes: rule ? String(Math.max(0, Math.round(rule.cooldownMs / 60_000))) : "5",
    enabled: rule?.enabled ?? true,
  };
}

function inputFromDraft(draft: RuleDraft): AlertRuleInput {
  return {
    name: draft.name.trim(),
    entityType: draft.entityType,
    condition: draft.condition.trim(),
    threshold: Number(draft.threshold),
    action: draft.action,
    cooldownMs: Math.max(0, Number(draft.cooldownMinutes)) * 60_000,
    enabled: draft.enabled,
  };
}

export function RuleForm(props: {
  entityTypes: string[];
  rule?: DeckGoAlertRule;
  saving: boolean;
  onSubmit: (input: AlertRuleInput) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("alerts");
  const tc = useTranslations("common");
  const entityTypes = props.entityTypes.length > 0 ? props.entityTypes : ["usage"];
  const [draft, setDraft] = useState<RuleDraft>(() => draftFromRule(props.rule, entityTypes[0]));
  const [validationMessage, setValidationMessage] = useState("");

  const validate = () => {
    if (!draft.name.trim()) {
      return t("validationNameRequired");
    }
    if (!draft.condition.trim()) {
      return t("validationConditionRequired");
    }
    if (!Number.isFinite(Number(draft.threshold))) {
      return t("validationThresholdNumber");
    }
    if (!Number.isFinite(Number(draft.cooldownMinutes)) || Number(draft.cooldownMinutes) < 0) {
      return t("validationCooldownNumber");
    }
    return "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = validate();
    if (message) {
      setValidationMessage(message);
      return;
    }
    setValidationMessage("");
    await props.onSubmit(inputFromDraft(draft));
  };

  return (
    <form className="alerts-panel__form" onSubmit={handleSubmit}>
      <label className="alerts-panel__field">
        <span>{t("name")}</span>
        <input
          aria-label="alert rule name"
          className="alerts-panel__input"
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        />
      </label>

      <div className="alerts-panel__form-block">
        <p className="alerts-panel__label">{t("entityType")}</p>
        <div className="alerts-panel__entity-grid">
          {entityTypes.map((entityType) => (
            <button
              aria-pressed={draft.entityType === entityType}
              className={`alerts-panel__entity-tile ${draft.entityType === entityType ? "is-active" : ""}`}
              key={entityType}
              type="button"
              onClick={() => setDraft((current) => ({ ...current, entityType }))}
            >
              <span aria-hidden="true">{entityType.slice(0, 2).toUpperCase()}</span>
              {entityType}
            </button>
          ))}
        </div>
      </div>

      <label className="alerts-panel__field">
        <span>{t("condition")}</span>
        <input
          aria-label="alert condition"
          className="alerts-panel__input alerts-panel__input--mono"
          value={draft.condition}
          onChange={(event) =>
            setDraft((current) => ({ ...current, condition: event.target.value }))
          }
        />
      </label>

      <div className="alerts-panel__field-grid">
        <label className="alerts-panel__field">
          <span>{t("threshold")}</span>
          <input
            aria-label="alert threshold"
            className="alerts-panel__input"
            step="any"
            type="number"
            value={draft.threshold}
            onChange={(event) =>
              setDraft((current) => ({ ...current, threshold: event.target.value }))
            }
          />
        </label>
        <label className="alerts-panel__field">
          <span>
            {t("cooldown")} ({t("cooldownMinutes")})
          </span>
          <input
            aria-label="alert cooldown minutes"
            className="alerts-panel__input"
            min="0"
            type="number"
            value={draft.cooldownMinutes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, cooldownMinutes: event.target.value }))
            }
          />
        </label>
      </div>

      <div className="alerts-panel__form-block">
        <p className="alerts-panel__label">{t("action")}</p>
        <div className="alerts-panel__action-grid">
          {ACTIONS.map((action) => (
            <button
              aria-pressed={draft.action === action}
              className={`alerts-panel__action-tile alerts-panel__action-tile--${action} ${draft.action === action ? "is-active" : ""}`}
              key={action}
              type="button"
              onClick={() => setDraft((current) => ({ ...current, action }))}
            >
              <strong>{t(action)}</strong>
              <span>{t(`${action}Description`)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="alerts-panel__form-block">
        <p className="alerts-panel__label">{t("cooldownPresets")}</p>
        <div className="alerts-panel__seg alerts-panel__seg--cooldown" role="tablist">
          {COOLDOWN_PRESETS.map((minutes) => (
            <button
              aria-selected={draft.cooldownMinutes === String(minutes)}
              className={draft.cooldownMinutes === String(minutes) ? "is-active" : ""}
              key={minutes}
              role="tab"
              type="button"
              onClick={() =>
                setDraft((current) => ({ ...current, cooldownMinutes: String(minutes) }))
              }
            >
              {minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={`alerts-panel__switch ${draft.enabled ? "is-on" : ""}`}
        role="switch"
        aria-checked={draft.enabled}
        onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
      >
        <span>{t("enabled")}</span>
        <span className="alerts-panel__switch-track" aria-hidden="true">
          <span className="alerts-panel__switch-thumb" />
        </span>
      </button>

      {validationMessage ? (
        <p className="alerts-panel__error" aria-live="polite">
          {validationMessage}
        </p>
      ) : null}

      <div className="alerts-panel__actions">
        <button className="alerts-panel__button is-primary" disabled={props.saving} type="submit">
          {props.saving ? tc("saving") : props.rule ? t("editRule") : t("addRule")}
        </button>
        <button className="alerts-panel__button" type="button" onClick={props.onCancel}>
          {tc("cancel")}
        </button>
      </div>
    </form>
  );
}
