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

const ENTITY_TYPES = ["usage", "cron", "approval", "agent"];
const ACTIONS: DeckGoAlertAction[] = ["toast", "activity", "webhook"];

function draftFromRule(rule: DeckGoAlertRule | undefined): RuleDraft {
  return {
    name: rule?.name ?? "",
    entityType: rule?.entityType ?? "usage",
    condition: rule?.condition ?? "",
    threshold: rule ? String(rule.threshold) : "0",
    action: rule?.action ?? "toast",
    cooldownMinutes: rule ? String(Math.round(rule.cooldownMs / 60_000)) : "5",
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
  rule?: DeckGoAlertRule;
  saving: boolean;
  onSubmit: (input: AlertRuleInput) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("alerts");
  const [draft, setDraft] = useState<RuleDraft>(() => draftFromRule(props.rule));
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
    <form className="deck-ui-control-form deck-ui-alerts-form" onSubmit={handleSubmit}>
      <h3 className="deck-ui-control-section-title">{props.rule ? t("editRule") : t("addRule")}</h3>

      <label className="deck-ui-control-field">
        <span>{t("name")}</span>
        <input
          aria-label="alert rule name"
          className="deckgo-input deck-ui-alerts-input"
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        />
      </label>

      <div className="deck-ui-control-form-grid">
        <label className="deck-ui-control-field">
          <span>{t("entityType")}</span>
          <select
            aria-label="alert entity type"
            className="deckgo-input deck-ui-alerts-input"
            value={draft.entityType}
            onChange={(event) =>
              setDraft((current) => ({ ...current, entityType: event.target.value }))
            }
          >
            {ENTITY_TYPES.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </select>
        </label>
        <label className="deck-ui-control-field">
          <span>{t("action")}</span>
          <select
            aria-label="alert action"
            className="deckgo-input deck-ui-alerts-input"
            value={draft.action}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                action: event.target.value as DeckGoAlertAction,
              }))
            }
          >
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {t(action)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="deck-ui-control-field">
        <span>{t("condition")}</span>
        <input
          aria-label="alert condition"
          className="deckgo-input deck-ui-alerts-input"
          value={draft.condition}
          onChange={(event) =>
            setDraft((current) => ({ ...current, condition: event.target.value }))
          }
        />
      </label>

      <div className="deck-ui-control-form-grid">
        <label className="deck-ui-control-field">
          <span>{t("threshold")}</span>
          <input
            aria-label="alert threshold"
            className="deckgo-input deck-ui-alerts-input"
            step="any"
            type="number"
            value={draft.threshold}
            onChange={(event) =>
              setDraft((current) => ({ ...current, threshold: event.target.value }))
            }
          />
        </label>
        <label className="deck-ui-control-field">
          <span>
            {t("cooldown")} ({t("cooldownMinutes")})
          </span>
          <input
            aria-label="alert cooldown minutes"
            className="deckgo-input deck-ui-alerts-input"
            min="0"
            type="number"
            value={draft.cooldownMinutes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, cooldownMinutes: event.target.value }))
            }
          />
        </label>
      </div>

      <button
        type="button"
        className={`deck-ui-control-switch ${draft.enabled ? "is-on" : ""}`}
        role="switch"
        aria-checked={draft.enabled}
        onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
      >
        <span>{t("enabled")}</span>
        <span className="deck-ui-control-switch-track" aria-hidden="true">
          <span className="deck-ui-control-switch-thumb" />
        </span>
      </button>

      {validationMessage ? <p className="deck-ui-control-error">{validationMessage}</p> : null}

      <div className="deckgo-actions deck-ui-alerts-actions">
        <button
          className="deckgo-button is-primary deck-ui-alerts-button"
          disabled={props.saving}
          type="submit"
        >
          {props.rule ? t("editRule") : t("addRule")}
        </button>
        <button
          className="deckgo-button deck-ui-alerts-button"
          type="button"
          onClick={props.onCancel}
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
