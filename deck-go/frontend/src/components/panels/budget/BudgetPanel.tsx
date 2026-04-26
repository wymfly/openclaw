import { useEffect, useState } from "react";
import type { DeckGoBudgetEvaluation, DeckGoBudgetRule } from "../../../api";
import {
  createBudgetRule,
  deleteBudgetRule,
  evaluateBudgetRules,
  fetchBudgetRules,
  updateBudgetRule,
} from "../../../api";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";
type BudgetScope = "global" | "agent" | "task";
type BudgetPeriod = "daily" | "weekly" | "monthly";

type RuleDraft = {
  name: string;
  scope: string;
  agentId: string;
  taskId: string;
  dimension: DeckGoBudgetRule["dimension"];
  warnThreshold: string;
  overThreshold: string;
  period: string;
  enabled: boolean;
};

const BUDGET_SCOPES: BudgetScope[] = ["global", "agent", "task"];
const BUDGET_PERIODS: BudgetPeriod[] = ["daily", "weekly", "monthly"];

const DEFAULT_DRAFT: RuleDraft = {
  name: "",
  scope: "global",
  agentId: "",
  taskId: "",
  dimension: "cost",
  warnThreshold: "10",
  overThreshold: "20",
  period: "monthly",
  enabled: true,
};

function normalizeBudgetScope(scope: string): BudgetScope {
  if (scope === "perAgent") {
    return "agent";
  }
  if (scope === "perTask") {
    return "task";
  }
  return BUDGET_SCOPES.includes(scope as BudgetScope) ? (scope as BudgetScope) : "global";
}

function normalizeBudgetPeriod(period: string): BudgetPeriod {
  return BUDGET_PERIODS.includes(period as BudgetPeriod) ? (period as BudgetPeriod) : "monthly";
}

function statusPillClass(status: DeckGoBudgetEvaluation["status"]) {
  if (status === "over") {
    return "is-danger";
  }
  if (status === "warn") {
    return "is-warning";
  }
  return "is-positive";
}

function formatBudgetValue(
  value: number | null | undefined,
  dimension: DeckGoBudgetRule["dimension"],
) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  if (dimension === "cost") {
    return `$${value.toFixed(2)}`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

function budgetProgressPercent(evaluation: DeckGoBudgetEvaluation) {
  const threshold = evaluation.overThreshold ?? evaluation.warnThreshold ?? 0;
  if (threshold <= 0) {
    return 0;
  }
  return Math.min((evaluation.current / threshold) * 100, 100);
}

function parseBudgetThreshold(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return Number(trimmed);
}

function validateBudgetThreshold(label: string, value: string) {
  const threshold = parseBudgetThreshold(value);
  if (threshold == null) {
    return "";
  }
  if (!Number.isFinite(threshold)) {
    return `${label} must be a number`;
  }
  if (threshold < 0) {
    return `${label} must be zero or greater`;
  }
  return "";
}

function budgetInputFromDraft(draft: RuleDraft) {
  const scope = normalizeBudgetScope(draft.scope);
  return {
    name: draft.name.trim(),
    scope,
    agentId: scope === "agent" ? draft.agentId.trim() || null : null,
    taskId: scope === "task" ? draft.taskId.trim() || null : null,
    dimension: draft.dimension,
    warnThreshold: parseBudgetThreshold(draft.warnThreshold),
    overThreshold: parseBudgetThreshold(draft.overThreshold),
    period: normalizeBudgetPeriod(draft.period),
    enabled: draft.enabled,
  };
}

function draftFromRule(rule: DeckGoBudgetRule): RuleDraft {
  return {
    name: rule.name,
    scope: normalizeBudgetScope(rule.scope),
    agentId: rule.agentId ?? "",
    taskId: rule.taskId ?? "",
    dimension: rule.dimension,
    warnThreshold: rule.warnThreshold != null ? String(rule.warnThreshold) : "",
    overThreshold: rule.overThreshold != null ? String(rule.overThreshold) : "",
    period: rule.period,
    enabled: rule.enabled,
  };
}

function nextDraftForScope(current: RuleDraft, scope: string): RuleDraft {
  const normalized = normalizeBudgetScope(scope);
  return {
    ...current,
    scope: normalized,
    agentId: normalized === "agent" ? current.agentId : "",
    taskId: normalized === "task" ? current.taskId : "",
  };
}

export function BudgetPanel() {
  const [rules, setRules] = useState<DeckGoBudgetRule[]>([]);
  const [evaluations, setEvaluations] = useState<DeckGoBudgetEvaluation[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "creating" | "updating" | "deleting">(
    "idle",
  );
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const refresh = async (preferredRuleId?: string) => {
    setLoadState("loading");
    try {
      const [rulesResponse, evalResponse] = await Promise.all([
        fetchBudgetRules(),
        evaluateBudgetRules(),
      ]);
      const nextRules = rulesResponse.rules ?? [];
      setRules(nextRules);
      setEvaluations(evalResponse.evaluations ?? []);
      setLoadState("ready");
      setError("");
      const fallbackId = preferredRuleId?.trim() || nextRules[0]?.id || "";
      setSelectedRuleId((current) =>
        fallbackId && nextRules.some((rule) => rule.id === fallbackId)
          ? fallbackId
          : current && nextRules.some((rule) => rule.id === current)
            ? current
            : nextRules[0]?.id || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load budget rules");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const selectedRule = rules.find((rule) => rule.id === selectedRuleId) ?? rules[0] ?? null;
  const selectedEvaluation = selectedRule
    ? (evaluations.find((evaluation) => evaluation.ruleId === selectedRule.id) ?? null)
    : null;
  const evaluationByRuleId = new Map(
    evaluations.map((evaluation) => [evaluation.ruleId, evaluation]),
  );

  const validateDraft = (actionLabel: string) => {
    if (!draft.name.trim()) {
      setError(`${actionLabel} requires a rule name`);
      return false;
    }
    const scope = normalizeBudgetScope(draft.scope);
    if (scope === "agent" && !draft.agentId.trim()) {
      setError(`${actionLabel} requires an agent id`);
      return false;
    }
    if (scope === "task" && !draft.taskId.trim()) {
      setError(`${actionLabel} requires a task id`);
      return false;
    }
    const warnError = validateBudgetThreshold("warn threshold", draft.warnThreshold);
    if (warnError) {
      setError(`${actionLabel} ${warnError}`);
      return false;
    }
    const overError = validateBudgetThreshold("over threshold", draft.overThreshold);
    if (overError) {
      setError(`${actionLabel} ${overError}`);
      return false;
    }
    return true;
  };

  const createAction = async () => {
    if (!validateDraft("create")) {
      return;
    }
    setActionState("creating");
    try {
      const result = await createBudgetRule(budgetInputFromDraft(draft));
      setActionResult(result);
      setError("");
      setDraft(DEFAULT_DRAFT);
      await refresh(result.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "budget rule create failed");
    } finally {
      setActionState("idle");
    }
  };

  const updateSelectedAction = async () => {
    if (!selectedRule) {
      return;
    }
    if (!validateDraft("update")) {
      return;
    }
    setActionState("updating");
    try {
      const result = await updateBudgetRule(selectedRule.id, budgetInputFromDraft(draft));
      setActionResult(result);
      setError("");
      await refresh(selectedRule.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "budget rule update failed");
    } finally {
      setActionState("idle");
    }
  };

  const toggleAction = async (enabled: boolean) => {
    if (!selectedRule) {
      return;
    }
    setActionState("updating");
    try {
      const result = await updateBudgetRule(selectedRule.id, { enabled });
      setActionResult(result);
      setError("");
      await refresh(selectedRule.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "budget rule update failed");
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!selectedRule) {
      return;
    }
    if (!window.confirm(`Delete budget rule ${selectedRule.id}?`)) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteBudgetRule(selectedRule.id);
      setActionResult(result);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "budget rule delete failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-budget">
      <div className="deckgo-column deck-ui-budget-column">
        <article className="deckgo-card is-float deck-ui-budget-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Budget rules</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Budget rules are loaded from the control plane with current evaluation snapshots.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-budget-body">
            <div className="deckgo-pill-row deck-ui-budget-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Budget {loadState}
              </span>
              <span className="deckgo-pill">{rules.length} rules</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2 deck-ui-budget-stats">
              <ShellStat label="rules" value={rules.length} />
              <ShellStat label="evaluations" value={evaluations.length} />
            </div>
            {evaluations.length > 0 ? (
              <div className="deckgo-surface-tile deck-ui-budget-surface">
                <p className="deckgo-surface-label">Budget status</p>
                <div className="deckgo-usage-chart deck-ui-budget-chart">
                  {evaluations.map((evaluation) => (
                    <div
                      className="deckgo-usage-chart-row deck-ui-budget-chart-row"
                      key={evaluation.ruleId}
                    >
                      <span className="deckgo-usage-chart-label">{evaluation.ruleName}</span>
                      <span className="deckgo-usage-chart-track">
                        <progress
                          className={`deckgo-usage-chart-bar ${
                            evaluation.status === "over" ? "is-model" : "is-cost"
                          }`}
                          max={100}
                          value={budgetProgressPercent(evaluation)}
                        />
                      </span>
                      <span className="deckgo-usage-chart-value">
                        {formatBudgetValue(evaluation.current, evaluation.dimension)} /{" "}
                        {formatBudgetValue(
                          evaluation.overThreshold ?? evaluation.warnThreshold,
                          evaluation.dimension,
                        )}
                      </span>
                      <span className="deckgo-usage-chart-detail">
                        <span className={`deckgo-pill ${statusPillClass(evaluation.status)}`}>
                          {evaluation.status}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="deckgo-surface-tile deck-ui-budget-surface">
              <p className="deckgo-surface-label">Create rule</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-budget-form-grid">
                <input
                  aria-label="budget rule name"
                  className="deckgo-input deck-ui-budget-input"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="name"
                />
                <select
                  aria-label="budget scope"
                  className="deckgo-input deck-ui-budget-input"
                  value={draft.scope}
                  onChange={(event) =>
                    setDraft((current) => nextDraftForScope(current, event.target.value))
                  }
                >
                  {BUDGET_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {scope}
                    </option>
                  ))}
                </select>
                {draft.scope === "agent" ? (
                  <input
                    aria-label="budget agent id"
                    className="deckgo-input deck-ui-budget-input"
                    value={draft.agentId}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, agentId: event.target.value }))
                    }
                    placeholder="agent id"
                  />
                ) : null}
                {draft.scope === "task" ? (
                  <input
                    aria-label="budget task id"
                    className="deckgo-input deck-ui-budget-input"
                    value={draft.taskId}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, taskId: event.target.value }))
                    }
                    placeholder="task id"
                  />
                ) : null}
                <select
                  aria-label="budget dimension"
                  className="deckgo-input deck-ui-budget-input"
                  value={draft.dimension}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      dimension: event.target.value as DeckGoBudgetRule["dimension"],
                    }))
                  }
                >
                  <option value="cost">cost</option>
                  <option value="tokensIn">tokensIn</option>
                  <option value="tokensOut">tokensOut</option>
                  <option value="totalTokens">totalTokens</option>
                </select>
                <select
                  aria-label="budget period"
                  className="deckgo-input deck-ui-budget-input"
                  value={draft.period}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, period: event.target.value }))
                  }
                >
                  {BUDGET_PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="budget warn threshold"
                  className="deckgo-input deck-ui-budget-input"
                  min="0"
                  step="any"
                  type="number"
                  value={draft.warnThreshold}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, warnThreshold: event.target.value }))
                  }
                  placeholder="warn threshold"
                />
                <input
                  aria-label="budget over threshold"
                  className="deckgo-input deck-ui-budget-input"
                  min="0"
                  step="any"
                  type="number"
                  value={draft.overThreshold}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, overThreshold: event.target.value }))
                  }
                  placeholder="over threshold"
                />
              </div>
              <label className="deckgo-label deck-ui-budget-check">
                <span>Rule enabled</span>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
              </label>
              <div className="deckgo-actions deck-ui-budget-actions deck-ui-budget-actions-offset">
                <button
                  className="deckgo-button deck-ui-budget-button"
                  type="button"
                  onClick={() => void refresh(selectedRuleId)}
                >
                  Refresh budget
                </button>
                <button
                  className="deckgo-button is-primary deck-ui-budget-button"
                  type="button"
                  onClick={() => void createAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "creating" ? "Creating" : "Create rule"}
                </button>
                <button
                  className="deckgo-button deck-ui-budget-button"
                  type="button"
                  onClick={() => selectedRule && setDraft(draftFromRule(selectedRule))}
                  disabled={!selectedRule || actionState !== "idle"}
                >
                  Load selected
                </button>
                <button
                  className="deckgo-button deck-ui-budget-button"
                  type="button"
                  onClick={() => void updateSelectedAction()}
                  disabled={!selectedRule || actionState !== "idle"}
                >
                  {actionState === "updating" ? "Saving" : "Save selected"}
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note deck-ui-budget-error">{error}</p> : null}
            {rules.length === 0 ? (
              <p className="deckgo-note deck-ui-budget-empty">No budget rules loaded.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-budget-list">
                {rules.map((rule) => {
                  const evaluation = evaluationByRuleId.get(rule.id);
                  return (
                    <li key={rule.id}>
                      <button
                        type="button"
                        className={`deckgo-selectable-card deck-ui-budget-row ${selectedRule?.id === rule.id ? "is-selected" : ""}`}
                        onClick={() => setSelectedRuleId(rule.id)}
                      >
                        <strong>{rule.name}</strong>
                        <div className="deckgo-meta">
                          {rule.dimension} | warn: {rule.warnThreshold ?? "n/a"} | over:{" "}
                          {rule.overThreshold ?? "n/a"}
                        </div>
                        <div className="deckgo-meta">enabled: {rule.enabled ? "yes" : "no"}</div>
                        <div className="deckgo-pill-row deck-ui-budget-status-row">
                          {evaluation ? (
                            <span className={`deckgo-pill ${statusPillClass(evaluation.status)}`}>
                              {evaluation.status}
                            </span>
                          ) : null}
                          {!rule.enabled ? (
                            <span className="deckgo-pill is-muted">disabled</span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-budget-column">
        <article className="deckgo-card is-float deck-ui-budget-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected rule</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Inspect rule status, progress, thresholds, and active evaluations from the selected
            rule.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-budget-body">
            {selectedRule ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-budget-hero">
                  <div>
                    <p className="deckgo-kicker">Rule</p>
                    <strong>{selectedRule.name}</strong>
                    <p className="deckgo-note">
                      {selectedRule.scope} · {selectedRule.period}
                    </p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-budget-status-row">
                    <span className="deckgo-pill">{selectedRule.dimension}</span>
                    <span className="deckgo-pill">
                      {selectedRule.enabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-budget-detail-stats">
                  <ShellStat label="warn" value={selectedRule.warnThreshold ?? "n/a"} />
                  <ShellStat label="over" value={selectedRule.overThreshold ?? "n/a"} />
                </div>
                {selectedEvaluation ? (
                  <div className="deckgo-surface-tile deck-ui-budget-surface">
                    <p className="deckgo-surface-label">Selected rule status</p>
                    <div className="deckgo-usage-chart-row deck-ui-budget-chart-row">
                      <span className="deckgo-usage-chart-label">{selectedEvaluation.status}</span>
                      <span className="deckgo-usage-chart-track">
                        <progress
                          className={`deckgo-usage-chart-bar ${
                            selectedEvaluation.status === "over" ? "is-model" : "is-cost"
                          }`}
                          max={100}
                          value={budgetProgressPercent(selectedEvaluation)}
                        />
                      </span>
                      <span className="deckgo-usage-chart-value">
                        {formatBudgetValue(
                          selectedEvaluation.current,
                          selectedEvaluation.dimension,
                        )}
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="deckgo-actions deck-ui-budget-actions">
                  <button
                    className="deckgo-button deck-ui-budget-button"
                    type="button"
                    onClick={() => void toggleAction(!selectedRule.enabled)}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "updating"
                      ? "Updating"
                      : selectedRule.enabled
                        ? "Disable"
                        : "Enable"}
                  </button>
                  <button
                    className="deckgo-button is-danger deck-ui-budget-button"
                    type="button"
                    onClick={() => void deleteAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "deleting" ? "Deleting" : "Delete"}
                  </button>
                </div>
                {selectedEvaluation ? (
                  <JsonDetails title="Evaluation" payload={selectedEvaluation} />
                ) : null}
                <JsonDetails title="Rule payload" payload={selectedRule} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-budget-empty">
                Choose a budget rule to inspect it.
              </p>
            )}
            {actionResult ? (
              <JsonDetails title="Last budget action" payload={actionResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
