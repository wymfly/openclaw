import { useEffect, useState, type FormEvent } from "react";
import type { DeckGoBudgetRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

type BudgetScope = "global" | "agent" | "task";
type BudgetPeriod = "daily" | "weekly" | "monthly";

type RuleDraft = {
  name: string;
  scope: BudgetScope;
  agentId: string;
  taskId: string;
  dimension: DeckGoBudgetRule["dimension"];
  warnThreshold: string;
  overThreshold: string;
  period: BudgetPeriod;
  enabled: boolean;
};

export type BudgetRuleInput = Omit<DeckGoBudgetRule, "id" | "createdAt" | "updatedAt">;

const DIMENSIONS: DeckGoBudgetRule["dimension"][] = [
  "tokensIn",
  "tokensOut",
  "totalTokens",
  "cost",
];
const SCOPES: BudgetScope[] = ["global", "agent", "task"];
const PERIODS: BudgetPeriod[] = ["daily", "weekly", "monthly"];

const EMPTY_DRAFT: RuleDraft = {
  name: "",
  scope: "global",
  agentId: "",
  taskId: "",
  dimension: "totalTokens",
  warnThreshold: "",
  overThreshold: "",
  period: "monthly",
  enabled: true,
};

function normalizeScope(rule: DeckGoBudgetRule): BudgetScope {
  if (rule.scope === "agent" || rule.scope === "perAgent" || rule.agentId) {
    return "agent";
  }
  if (rule.scope === "task" || rule.scope === "perTask" || rule.taskId) {
    return "task";
  }
  return "global";
}

function normalizePeriod(period: string): BudgetPeriod {
  return PERIODS.includes(period as BudgetPeriod) ? (period as BudgetPeriod) : "monthly";
}

function draftFromRule(rule: DeckGoBudgetRule | null): RuleDraft {
  if (!rule) {
    return EMPTY_DRAFT;
  }
  return {
    name: rule.name,
    scope: normalizeScope(rule),
    agentId: rule.agentId ?? "",
    taskId: rule.taskId ?? "",
    dimension: rule.dimension,
    warnThreshold: rule.warnThreshold != null ? String(rule.warnThreshold) : "",
    overThreshold: rule.overThreshold != null ? String(rule.overThreshold) : "",
    period: normalizePeriod(rule.period),
    enabled: rule.enabled,
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function inputFromDraft(draft: RuleDraft): BudgetRuleInput {
  return {
    name: draft.name.trim(),
    scope: draft.scope,
    agentId: draft.scope === "agent" ? draft.agentId.trim() || null : null,
    taskId: draft.scope === "task" ? draft.taskId.trim() || null : null,
    dimension: draft.dimension,
    warnThreshold: parseOptionalNumber(draft.warnThreshold),
    overThreshold: parseOptionalNumber(draft.overThreshold),
    period: draft.period,
    enabled: draft.enabled,
  };
}

function scopeLabelKey(scope: BudgetScope) {
  if (scope === "agent") {
    return "perAgent";
  }
  if (scope === "task") {
    return "perTask";
  }
  return "global";
}

export function RuleForm(props: {
  rule: DeckGoBudgetRule | null;
  saving: boolean;
  onSave: (input: BudgetRuleInput) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("budget");
  const tc = useTranslations("common");
  const [draft, setDraft] = useState<RuleDraft>(() => draftFromRule(props.rule));
  const [validationMessage, setValidationMessage] = useState("");

  useEffect(() => {
    setDraft(draftFromRule(props.rule));
    setValidationMessage("");
  }, [props.rule]);

  const updateScope = (scope: BudgetScope) => {
    setDraft((current) => ({
      ...current,
      scope,
      agentId: scope === "agent" ? current.agentId : "",
      taskId: scope === "task" ? current.taskId : "",
    }));
  };

  const validate = () => {
    if (!draft.name.trim()) {
      return t("validationNameRequired");
    }
    if (draft.scope === "agent" && !draft.agentId.trim()) {
      return t("validationAgentRequired");
    }
    if (draft.scope === "task" && !draft.taskId.trim()) {
      return t("validationTaskRequired");
    }
    for (const [key, value] of [
      ["warnThreshold", draft.warnThreshold],
      ["overThreshold", draft.overThreshold],
    ] as const) {
      const parsed = parseOptionalNumber(value);
      if (parsed == null) {
        continue;
      }
      if (!Number.isFinite(parsed)) {
        return t("validationNumber", { field: t(key) });
      }
      if (parsed < 0) {
        return t("validationNonnegative", { field: t(key) });
      }
    }
    const warnThreshold = parseOptionalNumber(draft.warnThreshold);
    const overThreshold = parseOptionalNumber(draft.overThreshold);
    if (warnThreshold != null && overThreshold != null && warnThreshold >= overThreshold) {
      return t("validationWarnBelowOver");
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
    await props.onSave(inputFromDraft(draft));
  };

  return (
    <form className="budget-panel__form" onSubmit={handleSubmit}>
      <h3 className="budget-panel__card-title">{props.rule ? t("editRule") : t("addRule")}</h3>

      <label className="budget-panel__field">
        <span>{t("name")}</span>
        <input
          aria-label="budget rule name"
          className="budget-panel__input"
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        />
      </label>

      <div className="budget-panel__field">
        <span>{t("scope")}</span>
        <div className="budget-panel__segments">
          {SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              className={`budget-panel__segment ${draft.scope === scope ? "is-selected" : ""}`}
              aria-pressed={draft.scope === scope}
              onClick={() => updateScope(scope)}
            >
              {t(scopeLabelKey(scope))}
            </button>
          ))}
        </div>
      </div>

      {draft.scope === "agent" ? (
        <label className="budget-panel__field">
          <span>{t("agentId")}</span>
          <input
            aria-label="budget agent id"
            className="budget-panel__input"
            value={draft.agentId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, agentId: event.target.value }))
            }
          />
        </label>
      ) : null}

      {draft.scope === "task" ? (
        <label className="budget-panel__field">
          <span>{t("taskId")}</span>
          <input
            aria-label="budget task id"
            className="budget-panel__input"
            value={draft.taskId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, taskId: event.target.value }))
            }
          />
        </label>
      ) : null}

      <div className="budget-panel__field">
        <span>{t("dimension")}</span>
        <div className="budget-panel__segments">
          {DIMENSIONS.map((dimension) => (
            <button
              key={dimension}
              type="button"
              className={`budget-panel__segment ${
                draft.dimension === dimension ? "is-selected" : ""
              }`}
              aria-pressed={draft.dimension === dimension}
              onClick={() => setDraft((current) => ({ ...current, dimension }))}
            >
              {t(dimension)}
            </button>
          ))}
        </div>
      </div>

      <div className="budget-panel__field-grid">
        <label className="budget-panel__field">
          <span>{t("warnThreshold")}</span>
          <input
            aria-label="budget warn threshold"
            className="budget-panel__input"
            min="0"
            step="any"
            type="number"
            value={draft.warnThreshold}
            onChange={(event) =>
              setDraft((current) => ({ ...current, warnThreshold: event.target.value }))
            }
          />
        </label>
        <label className="budget-panel__field">
          <span>{t("overThreshold")}</span>
          <input
            aria-label="budget over threshold"
            className="budget-panel__input"
            min="0"
            step="any"
            type="number"
            value={draft.overThreshold}
            onChange={(event) =>
              setDraft((current) => ({ ...current, overThreshold: event.target.value }))
            }
          />
        </label>
      </div>

      <div className="budget-panel__field">
        <span>{t("period")}</span>
        <div className="budget-panel__segments">
          {PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              className={`budget-panel__segment ${draft.period === period ? "is-selected" : ""}`}
              aria-pressed={draft.period === period}
              onClick={() => setDraft((current) => ({ ...current, period }))}
            >
              {t(period)}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={`budget-panel__switch ${draft.enabled ? "is-on" : ""}`}
        role="switch"
        aria-checked={draft.enabled}
        onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
      >
        <span>{t("enabledToggle")}</span>
        <span className="budget-panel__switch-track" aria-hidden="true">
          <span className="budget-panel__switch-thumb" />
        </span>
      </button>

      {validationMessage ? <p className="budget-panel__error">{validationMessage}</p> : null}

      <div className="budget-panel__actions">
        <button className="budget-panel__button is-primary" disabled={props.saving} type="submit">
          {props.saving ? tc("saving") : tc("save")}
        </button>
        <button className="budget-panel__button" type="button" onClick={props.onCancel}>
          {tc("cancel")}
        </button>
      </div>
    </form>
  );
}
