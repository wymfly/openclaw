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
import { BudgetStatus } from "./BudgetStatus";
import { RuleForm, type BudgetRuleInput } from "./RuleForm";
import { RuleList } from "./RuleList";

type PanelState = "idle" | "loading" | "ready";
type ViewMode = "list" | "form";

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

  const handleSelect = (rule: DeckGoBudgetRule) => {
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
      } else {
        const result = await createBudgetRule(input);
        await refresh(result.id);
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
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="deck-ui-control-shell deck-ui-budget">
      <aside className="deck-ui-control-sidebar deck-ui-budget-sidebar">
        <div className="deck-ui-control-sidebar-header">
          <h2>{t("title")}</h2>
          <button
            className="deckgo-button is-primary deck-ui-budget-button"
            type="button"
            onClick={handleCreate}
          >
            + {tc("create")}
          </button>
        </div>

        <div className="deck-ui-control-sidebar-meta">
          <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
            {loadState === "loading" ? tc("loading") : t(loadState)}
          </span>
          <span className="deckgo-pill">{t("ruleCount", { count: rules.length })}</span>
          <span className="deckgo-pill">{t("evaluationCount", { count: evaluations.length })}</span>
        </div>

        <div className="deck-ui-control-sidebar-scroll">
          {loadState === "loading" && rules.length === 0 ? (
            <p className="deck-ui-control-empty">{tc("loading")}</p>
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

      <main className="deck-ui-control-detail deck-ui-budget-detail">
        {error ? <p className="deck-ui-control-error">{error}</p> : null}

        {viewMode === "form" ? (
          <div className="deck-ui-control-stack">
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
              <div className="deck-ui-control-danger-row">
                {confirmDeleteId === editingRule.id ? (
                  <>
                    <button
                      className="deckgo-button is-danger deck-ui-budget-button"
                      disabled={saving}
                      type="button"
                      onClick={() => void handleDelete(editingRule.id)}
                    >
                      {t("confirmDelete")}
                    </button>
                    <button
                      className="deckgo-button deck-ui-budget-button"
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      {tc("cancel")}
                    </button>
                  </>
                ) : (
                  <button
                    className="deckgo-button is-danger deck-ui-budget-button"
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
        ) : (
          <div className="deck-ui-control-stack">
            <BudgetStatus evaluations={evaluations} />
            {evaluations.length === 0 && loadState !== "loading" ? (
              <div className="deck-ui-control-empty-state">
                <h3>{t("noRules")}</h3>
                <p>{t("emptyDescription")}</p>
              </div>
            ) : null}
            {selectedRule ? (
              <p className="deckgo-note">{t("selectedRuleHint", { name: selectedRule.name })}</p>
            ) : null}
          </div>
        )}
      </main>
    </section>
  );
}
