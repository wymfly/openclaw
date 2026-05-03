import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckGoBudgetEvaluation, DeckGoBudgetRule } from "../../../api";
import {
  createBudgetRule,
  deleteBudgetRule,
  evaluateBudgetRules,
  fetchBudgetRules,
  updateBudgetRule,
} from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { BudgetMetric } from "./BudgetMetric";
import {
  BudgetStatus,
  budgetProgressPercent,
  budgetStatusClass,
  formatBudgetValue,
} from "./BudgetStatus";
import { RuleForm, type BudgetRuleInput } from "./RuleForm";
import { RuleList } from "./RuleList";
import "./budget-panel.css";

type PanelState = "idle" | "loading" | "ready";
type ViewMode = "list" | "form";
type LastAction = "created" | "updated" | "deleted" | null;

function scopeLabelKey(rule: DeckGoBudgetRule) {
  if (rule.scope === "agent" || rule.scope === "perAgent" || rule.agentId) {
    return "perAgent";
  }
  if (rule.scope === "task" || rule.scope === "perTask" || rule.taskId) {
    return "perTask";
  }
  return "global";
}

function targetLabel(rule: DeckGoBudgetRule, fallback: string) {
  if (rule.agentId) {
    return rule.agentId;
  }
  if (rule.taskId) {
    return rule.taskId;
  }
  return fallback;
}

export function BudgetPanel() {
  const t = useTranslations("budget");
  const tc = useTranslations("common");
  const [rules, setRules] = useState<DeckGoBudgetRule[]>([]);
  const [evaluations, setEvaluations] = useState<DeckGoBudgetEvaluation[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingRule, setEditingRule] = useState<DeckGoBudgetRule | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<LastAction>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(
    async (preferredRuleId?: string) => {
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
        const fallbackId = preferredRuleId?.trim() || nextRules[0]?.id || null;
        setSelectedRuleId((current) =>
          fallbackId && nextRules.some((rule) => rule.id === fallbackId)
            ? fallbackId
            : current && nextRules.some((rule) => rule.id === current)
              ? current
              : nextRules[0]?.id || null,
        );
      } catch (loadError) {
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : t("loadRulesFailed"));
      }
    },
    [t],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId],
  );
  const evaluationByRuleId = useMemo(
    () => new Map(evaluations.map((evaluation) => [evaluation.ruleId, evaluation])),
    [evaluations],
  );
  const selectedEvaluation = selectedRule
    ? (evaluationByRuleId.get(selectedRule.id) ?? null)
    : null;
  const enabledCount = rules.filter((rule) => rule.enabled).length;
  const warningCount = evaluations.filter((evaluation) => evaluation.status === "warn").length;
  const overCount = evaluations.filter((evaluation) => evaluation.status === "over").length;

  const handleSelect = (rule: DeckGoBudgetRule) => {
    setSelectedRuleId(rule.id);
    setEditingRule(null);
    setConfirmDeleteId(null);
    setViewMode("list");
  };

  const handleEdit = (rule: DeckGoBudgetRule) => {
    setSelectedRuleId(rule.id);
    setEditingRule(rule);
    setConfirmDeleteId(null);
    setViewMode("form");
  };

  const handleCreate = () => {
    setSelectedRuleId(null);
    setEditingRule(null);
    setConfirmDeleteId(null);
    setViewMode("form");
  };

  const handleSave = async (input: BudgetRuleInput) => {
    setSaving(true);
    try {
      if (editingRule) {
        const result = await updateBudgetRule(editingRule.id, input);
        await refresh(result.id);
        setLastAction("updated");
      } else {
        const result = await createBudgetRule(input);
        await refresh(result.id);
        setLastAction("created");
      }
      setViewMode("list");
      setEditingRule(null);
      setConfirmDeleteId(null);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("saveRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    setSaving(true);
    try {
      await deleteBudgetRule(ruleId);
      await refresh();
      setViewMode("list");
      setEditingRule(null);
      setConfirmDeleteId(null);
      setLastAction("deleted");
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="budget-panel" data-testid="budget-panel">
      <header className="budget-panel__header">
        <div className="budget-panel__title-stack">
          <p className="budget-panel__eyebrow">{t("eyebrow")}</p>
          <h2 className="budget-panel__title">{t("title")}</h2>
          <p className="budget-panel__description">{t("subtitle")}</p>
        </div>
        <div className="budget-panel__header-actions">
          <button
            className="budget-panel__button"
            type="button"
            disabled={loadState === "loading"}
            onClick={() => void refresh(selectedRuleId ?? undefined)}
          >
            {t("refresh")}
          </button>
          <button className="budget-panel__button is-primary" type="button" onClick={handleCreate}>
            {tc("create")}
          </button>
        </div>
      </header>

      <div className="budget-panel__metrics">
        <BudgetMetric
          label={t("ruleMetric")}
          value={String(rules.length)}
          tone={rules.length > 0 ? "positive" : "neutral"}
        />
        <BudgetMetric label={t("enabledMetric")} value={String(enabledCount)} tone="positive" />
        <BudgetMetric
          label={t("warningMetric")}
          value={String(warningCount)}
          tone={warningCount > 0 ? "warning" : "neutral"}
        />
        <BudgetMetric
          label={t("overMetric")}
          value={String(overCount)}
          tone={overCount > 0 ? "danger" : "neutral"}
        />
      </div>

      {error ? <p className="budget-panel__error">{error}</p> : null}

      <div className="budget-panel__workspace">
        <aside className="budget-panel__card">
          <div className="budget-panel__card-head">
            <div>
              <h3 className="budget-panel__card-title">{t("ruleInventory")}</h3>
              <p className="budget-panel__meta">
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </p>
            </div>
            <div className="budget-panel__pill-row">
              <span className={`budget-panel__pill ${loadState === "ready" ? "is-positive" : ""}`}>
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </span>
              <span className="budget-panel__pill">{t("ruleCount", { count: rules.length })}</span>
            </div>
          </div>

          <div className="budget-panel__body">
            {loadState === "loading" && rules.length === 0 ? (
              <p className="budget-panel__empty">{tc("loading")}</p>
            ) : (
              <RuleList
                rules={rules}
                evaluations={evaluations}
                selectedRuleId={selectedRuleId}
                onSelect={handleSelect}
              />
            )}
          </div>
        </aside>

        <main className="budget-panel__column">
          {viewMode === "form" ? (
            <section className="budget-panel__card">
              <div className="budget-panel__card-head">
                <div>
                  <h3 className="budget-panel__card-title">
                    {editingRule ? t("editRule") : t("addRule")}
                  </h3>
                  <p className="budget-panel__meta">{t("formDescription")}</p>
                </div>
              </div>
              <div className="budget-panel__body">
                <RuleForm
                  rule={editingRule}
                  saving={saving}
                  onSave={handleSave}
                  onCancel={() => {
                    setViewMode("list");
                    setEditingRule(null);
                    setConfirmDeleteId(null);
                  }}
                />

                {editingRule ? (
                  <div className="budget-panel__actions">
                    {confirmDeleteId === editingRule.id ? (
                      <>
                        <button
                          className="budget-panel__button is-danger"
                          disabled={saving}
                          type="button"
                          onClick={() => void handleDelete(editingRule.id)}
                        >
                          {t("confirmDelete")}
                        </button>
                        <button
                          className="budget-panel__button"
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {tc("cancel")}
                        </button>
                      </>
                    ) : (
                      <button
                        className="budget-panel__button is-danger"
                        disabled={saving}
                        type="button"
                        onClick={() => setConfirmDeleteId(editingRule.id)}
                      >
                        {tc("delete")}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </section>
          ) : (
            <>
              <section className="budget-panel__card">
                <div className="budget-panel__card-head">
                  <div>
                    <h3 className="budget-panel__card-title">{t("selectedRule")}</h3>
                    <p className="budget-panel__meta">
                      {selectedRule ? t("guardrailEvidence") : t("emptyDescription")}
                    </p>
                  </div>
                  {selectedRule ? (
                    <button
                      className="budget-panel__button"
                      type="button"
                      onClick={() => handleEdit(selectedRule)}
                    >
                      {tc("edit")}
                    </button>
                  ) : null}
                </div>
                <div className="budget-panel__body budget-panel__detail-stack">
                  {selectedRule ? (
                    <>
                      <div className="budget-panel__hero">
                        <div>
                          <p className="budget-panel__eyebrow">{t("selected")}</p>
                          <strong>{selectedRule.name}</strong>
                          <p className="budget-panel__meta">
                            {t(scopeLabelKey(selectedRule))} ·{" "}
                            {targetLabel(selectedRule, t("global"))}
                          </p>
                        </div>
                        <div className="budget-panel__pill-row">
                          <span
                            className={`budget-panel__pill ${
                              selectedEvaluation
                                ? budgetStatusClass(selectedEvaluation.status)
                                : "is-muted"
                            }`}
                          >
                            {selectedEvaluation ? t(selectedEvaluation.status) : t("notEvaluated")}
                          </span>
                          <span className="budget-panel__pill">
                            {selectedRule.enabled ? t("enabled") : t("disabled")}
                          </span>
                        </div>
                      </div>

                      {selectedEvaluation ? (
                        <div className="budget-panel__surface">
                          <div className="budget-panel__status-head">
                            <strong>{t("thresholdProgress")}</strong>
                            <span
                              className={`budget-panel__pill ${budgetStatusClass(
                                selectedEvaluation.status,
                              )}`}
                            >
                              {Math.round(budgetProgressPercent(selectedEvaluation))}%
                            </span>
                          </div>
                          <progress
                            className={`budget-panel__progress ${budgetStatusClass(
                              selectedEvaluation.status,
                            )}`}
                            max={100}
                            value={budgetProgressPercent(selectedEvaluation)}
                            aria-label={t("progressLabel", { name: selectedRule.name })}
                          />
                        </div>
                      ) : (
                        <p className="budget-panel__empty">{t("notEvaluated")}</p>
                      )}

                      <div className="budget-panel__field-grid">
                        <div className="budget-panel__surface">
                          <p className="budget-panel__label">{t("dimension")}</p>
                          <strong>{t(selectedRule.dimension)}</strong>
                          <p className="budget-panel__meta">{t(selectedRule.period)}</p>
                        </div>
                        <div className="budget-panel__surface">
                          <p className="budget-panel__label">{t("current")}</p>
                          <strong>
                            {selectedEvaluation
                              ? formatBudgetValue(
                                  selectedEvaluation.current,
                                  selectedEvaluation.dimension,
                                )
                              : t("notAvailable")}
                          </strong>
                          <p className="budget-panel__meta">
                            {t("updatedAt")}: {selectedRule.updatedAt || t("notAvailable")}
                          </p>
                        </div>
                        <div className="budget-panel__surface">
                          <p className="budget-panel__label">{t("warnThreshold")}</p>
                          <strong>
                            {formatBudgetValue(selectedRule.warnThreshold, selectedRule.dimension)}
                          </strong>
                        </div>
                        <div className="budget-panel__surface">
                          <p className="budget-panel__label">{t("overThreshold")}</p>
                          <strong>
                            {formatBudgetValue(selectedRule.overThreshold, selectedRule.dimension)}
                          </strong>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="budget-panel__surface">
                      <h3 className="budget-panel__card-title">{t("noRules")}</h3>
                      <p className="budget-panel__note">{t("emptyDescription")}</p>
                    </div>
                  )}
                  {lastAction ? (
                    <p className="budget-panel__note">
                      {t("lastAction")}: {t(lastAction)}
                    </p>
                  ) : null}
                </div>
              </section>

              <BudgetStatus evaluations={evaluations} />
            </>
          )}
        </main>
      </div>
    </section>
  );
}
