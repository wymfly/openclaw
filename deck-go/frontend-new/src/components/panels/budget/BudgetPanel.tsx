import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeckGoBudgetEvaluation, DeckGoBudgetRule } from "@/api-types";
import { useDataFabricTransports } from "../../../data/client/scoped-query-provider";
import {
  budgetEvaluationsQueryOptions,
  budgetRulesQueryOptions,
  useCreateBudgetRuleMutation,
  useDeleteBudgetRuleMutation,
  useUpdateBudgetRuleMutation,
} from "../../../data/modules/budget";
import { useTranslations } from "../../../i18n/provider";
import { BudgetMetric } from "./BudgetMetric";
import { budgetProgressPercent, budgetStatusClass, formatBudgetValue } from "./BudgetStatus";
import { RuleForm, type BudgetRuleInput } from "./RuleForm";
import { RuleList } from "./RuleList";
import "./budget-panel.css";

type PanelState = "idle" | "loading" | "ready";
type LastAction = "created" | "updated" | "deleted" | null;
type StatusFilter = "all" | "ok" | "warn" | "over" | "disabled";
type BudgetDialog =
  | { type: "create" }
  | { type: "edit"; rule: DeckGoBudgetRule }
  | { type: "toggle"; rule: DeckGoBudgetRule }
  | { type: "delete"; rule: DeckGoBudgetRule }
  | null;
type LocalBudgetChange = {
  id: string;
  ruleId: string;
  kind: "create" | "update" | "enable" | "disable" | "delete";
  note: string;
  timestamp: string;
};

const STATUS_FILTERS: StatusFilter[] = ["all", "ok", "warn", "over", "disabled"];

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

function ruleStatusFilterValue(
  rule: DeckGoBudgetRule,
  evaluation: DeckGoBudgetEvaluation | undefined,
): Exclude<StatusFilter, "all"> {
  if (!rule.enabled) {
    return "disabled";
  }
  return evaluation?.status ?? "ok";
}

function ruleSearchText(rule: DeckGoBudgetRule) {
  return [rule.name, rule.scope, rule.agentId, rule.taskId, rule.dimension, rule.period]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function BudgetPanel() {
  const t = useTranslations("budget");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const { bff } = useDataFabricTransports();
  const createRuleMutation = useCreateBudgetRuleMutation();
  const updateRuleMutation = useUpdateBudgetRuleMutation();
  const deleteRuleMutation = useDeleteBudgetRuleMutation();
  const [rules, setRules] = useState<DeckGoBudgetRule[]>([]);
  const [evaluations, setEvaluations] = useState<DeckGoBudgetEvaluation[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [saving, setSaving] = useState(false);
  const [lastAction, setLastAction] = useState<LastAction>(null);
  const [dialog, setDialog] = useState<BudgetDialog>(null);
  const [localChanges, setLocalChanges] = useState<LocalBudgetChange[]>([]);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ruleQuery, setRuleQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(
    async (preferredRuleId?: string) => {
      setLoadState("loading");
      try {
        const rulesResponse = await queryClient.fetchQuery({
          ...budgetRulesQueryOptions(bff),
          staleTime: 0,
        });
        let nextEvaluations: DeckGoBudgetEvaluation[] = [];
        let evaluationError = "";
        try {
          const evalResponse = await queryClient.fetchQuery({
            ...budgetEvaluationsQueryOptions(bff),
            staleTime: 0,
          });
          nextEvaluations = evalResponse.evaluations ?? [];
        } catch (loadEvaluationError) {
          evaluationError =
            loadEvaluationError instanceof Error
              ? loadEvaluationError.message
              : t("evaluationLoadFailed");
        }
        const nextRules = rulesResponse.rules ?? [];
        setRules(nextRules);
        setEvaluations(nextEvaluations);
        setLoadState("ready");
        setError(evaluationError);
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
    [bff, queryClient, t],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && key === "n") {
        event.preventDefault();
        setDialog({ type: "create" });
      }
      if ((event.metaKey || event.ctrlKey) && key === "r") {
        event.preventDefault();
        void refresh(selectedRuleId ?? undefined);
      }
      if (event.key === "Escape") {
        setDialog(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [refresh, selectedRuleId]);

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
  const warningCount = evaluations.filter((evaluation) => evaluation.status === "warn").length;
  const overCount = evaluations.filter((evaluation) => evaluation.status === "over").length;
  const okCount = evaluations.filter((evaluation) => evaluation.status === "ok").length;
  const statusCounts = useMemo(() => {
    const next: Record<StatusFilter, number> = {
      all: rules.length,
      ok: 0,
      warn: 0,
      over: 0,
      disabled: 0,
    };
    for (const rule of rules) {
      next[ruleStatusFilterValue(rule, evaluationByRuleId.get(rule.id))]++;
    }
    return next;
  }, [evaluationByRuleId, rules]);
  const filteredRules = useMemo(() => {
    const normalizedQuery = ruleQuery.trim().toLowerCase();
    return rules.filter((rule) => {
      const status = ruleStatusFilterValue(rule, evaluationByRuleId.get(rule.id));
      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }
      return normalizedQuery ? ruleSearchText(rule).includes(normalizedQuery) : true;
    });
  }, [evaluationByRuleId, ruleQuery, rules, statusFilter]);
  const activeCriteria = [
    ruleQuery.trim() ? t("criteriaSearch", { value: ruleQuery.trim() }) : "",
    statusFilter !== "all" ? t("criteriaStatus", { value: t(`${statusFilter}Filter`) }) : "",
  ]
    .filter(Boolean)
    .join(" | ");
  const selectedRuleChanges = useMemo(
    () => localChanges.filter((change) => change.ruleId === selectedRuleId).slice(0, 6),
    [localChanges, selectedRuleId],
  );

  const recordLocalChange = (ruleId: string, kind: LocalBudgetChange["kind"], note: string) => {
    setLocalChanges((current) => [
      {
        id: `${Date.now()}-${kind}-${ruleId}`,
        kind,
        note,
        ruleId,
        timestamp: new Date().toISOString(),
      },
      ...current,
    ]);
  };

  const handleSelect = (rule: DeckGoBudgetRule) => {
    setSelectedRuleId(rule.id);
    setDialog(null);
  };

  const handleEdit = (rule: DeckGoBudgetRule) => {
    setSelectedRuleId(rule.id);
    setDialog({ type: "edit", rule });
  };

  const handleCreate = () => {
    setDialog({ type: "create" });
  };

  const handleSave = async (input: BudgetRuleInput) => {
    setSaving(true);
    try {
      if (dialog?.type === "edit") {
        const result = await updateRuleMutation.mutateAsync({
          id: dialog.rule.id,
          input,
        });
        await refresh(result.id);
        recordLocalChange(result.id, "update", t("changeUpdated", { name: result.name }));
        setLastAction("updated");
      } else {
        const result = await createRuleMutation.mutateAsync(input);
        await refresh(result.id);
        recordLocalChange(result.id, "create", t("changeCreated", { name: result.name }));
        setLastAction("created");
      }
      setDialog(null);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("saveRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: DeckGoBudgetRule) => {
    setSaving(true);
    try {
      const result = await updateRuleMutation.mutateAsync({
        id: rule.id,
        input: { enabled: !rule.enabled },
      });
      await refresh(result.id);
      recordLocalChange(
        result.id,
        result.enabled ? "enable" : "disable",
        result.enabled
          ? t("changeEnabled", { name: result.name })
          : t("changeDisabled", { name: result.name }),
      );
      setLastAction("updated");
      setDialog(null);
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
      const deletedRule = rules.find((rule) => rule.id === ruleId) ?? null;
      await deleteRuleMutation.mutateAsync(ruleId);
      await refresh();
      recordLocalChange(
        ruleId,
        "delete",
        t("changeDeleted", { name: deletedRule?.name ?? ruleId }),
      );
      setDialog(null);
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
          label={t("okMetric")}
          value={String(okCount)}
          tone={okCount > 0 ? "positive" : "neutral"}
        />
        <BudgetMetric label={t("warningMetric")} value={String(warningCount)} tone="warning" />
        <BudgetMetric
          label={t("overMetric")}
          value={String(overCount)}
          tone={overCount > 0 ? "danger" : "neutral"}
        />
        <BudgetMetric label={t("ruleMetric")} value={String(rules.length)} tone="neutral" />
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
            <div className="budget-panel__filters" aria-label={t("filterRules")}>
              <div className="budget-panel__filter-tabs" role="tablist">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === filter}
                    className={`budget-panel__filter-tab ${
                      statusFilter === filter ? "is-selected" : ""
                    } ${filter !== "all" ? `is-${filter}` : ""}`}
                    onClick={() => setStatusFilter(filter)}
                  >
                    {t(`${filter}Filter`)} <span>{statusCounts[filter]}</span>
                  </button>
                ))}
              </div>
              <label className="budget-panel__search">
                <span>{t("searchRules")}</span>
                <input
                  ref={searchRef}
                  aria-label="budget rule search"
                  className="budget-panel__input"
                  type="search"
                  value={ruleQuery}
                  placeholder={t("searchPlaceholder")}
                  onChange={(event) => setRuleQuery(event.target.value)}
                />
              </label>
            </div>
            {loadState === "loading" && rules.length === 0 ? (
              <p className="budget-panel__empty">{tc("loading")}</p>
            ) : (
              <RuleList
                rules={filteredRules}
                evaluations={evaluations}
                selectedRuleId={selectedRuleId}
                onSelect={handleSelect}
                activeCriteria={
                  rules.length > 0 && filteredRules.length === 0 ? activeCriteria : ""
                }
                clearLabel={t("clearFilters")}
                emptyLabel={rules.length === 0 ? t("noRules") : t("noMatchingRules")}
                onClearFilters={() => {
                  setRuleQuery("");
                  setStatusFilter("all");
                }}
              />
            )}
          </div>
        </aside>

        <main className="budget-panel__column">
          <section className="budget-panel__card">
            <div className="budget-panel__card-head">
              <div>
                <h3 className="budget-panel__card-title">{t("selectedRule")}</h3>
                <p className="budget-panel__meta">
                  {selectedRule ? t("guardrailEvidence") : t("emptyDescription")}
                </p>
              </div>
              {selectedRule ? (
                <div className="budget-panel__actions">
                  <button
                    className="budget-panel__button is-primary"
                    type="button"
                    onClick={() => handleEdit(selectedRule)}
                  >
                    {tc("edit")}
                  </button>
                  <button
                    className="budget-panel__button"
                    disabled={saving}
                    type="button"
                    onClick={() => setDialog({ type: "toggle", rule: selectedRule })}
                  >
                    {selectedRule.enabled ? t("disableRule") : t("enableRule")}
                  </button>
                  <button
                    className="budget-panel__button is-danger"
                    disabled={saving}
                    type="button"
                    onClick={() => setDialog({ type: "delete", rule: selectedRule })}
                  >
                    {tc("delete")}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="budget-panel__body budget-panel__detail-stack">
              {selectedRule ? (
                <>
                  <div className="budget-panel__hero">
                    <div>
                      <p className="budget-panel__eyebrow">{t("budgetRule")}</p>
                      <strong>{selectedRule.name}</strong>
                      <p className="budget-panel__meta">
                        {t(scopeLabelKey(selectedRule))} · {targetLabel(selectedRule, t("global"))}{" "}
                        · {t(selectedRule.period)}
                      </p>
                      <p className="budget-panel__meta">
                        id: <code>{selectedRule.id}</code> · {t("updatedAt")}:{" "}
                        {selectedRule.updatedAt || t("notAvailable")}
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

                  <div className="budget-panel__summary">
                    <div className="budget-panel__surface">
                      <p className="budget-panel__label">{t("status")}</p>
                      <strong>{selectedEvaluation ? t(selectedEvaluation.status) : "—"}</strong>
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
                    </div>
                    <div className="budget-panel__surface">
                      <p className="budget-panel__label">{t("warnThreshold")}</p>
                      <strong>
                        {formatBudgetValue(selectedRule.warnThreshold, selectedRule.dimension)}
                      </strong>
                      {selectedEvaluation && selectedRule.warnThreshold ? (
                        <span className="budget-panel__meta">
                          {Math.round(
                            (selectedEvaluation.current / selectedRule.warnThreshold) * 100,
                          )}
                          % {t("ofWarn")}
                        </span>
                      ) : null}
                    </div>
                    <div className="budget-panel__surface">
                      <p className="budget-panel__label">{t("overThreshold")}</p>
                      <strong>
                        {formatBudgetValue(selectedRule.overThreshold, selectedRule.dimension)}
                      </strong>
                      {selectedEvaluation && selectedRule.overThreshold ? (
                        <span className="budget-panel__meta">
                          {Math.round(
                            (selectedEvaluation.current / selectedRule.overThreshold) * 100,
                          )}
                          % {t("ofOver")}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <section className="budget-panel__section">
                    <div className="budget-panel__section-head">
                      <h4>{t("thresholdProgress")}</h4>
                      <p>{t("thresholdHint")}</p>
                    </div>
                    {selectedEvaluation ? (
                      <div className="budget-panel__threshold-card">
                        <progress
                          className={`budget-panel__progress ${budgetStatusClass(
                            selectedEvaluation.status,
                          )}`}
                          max={100}
                          value={budgetProgressPercent(selectedEvaluation)}
                          aria-label={t("progressLabel", { name: selectedRule.name })}
                        />
                        <div className="budget-panel__legend">
                          <span>
                            {t("current")}{" "}
                            {formatBudgetValue(
                              selectedEvaluation.current,
                              selectedEvaluation.dimension,
                            )}
                          </span>
                          <span>
                            {t("warnThreshold")}{" "}
                            {formatBudgetValue(selectedRule.warnThreshold, selectedRule.dimension)}
                          </span>
                          <span>
                            {t("overThreshold")}{" "}
                            {formatBudgetValue(selectedRule.overThreshold, selectedRule.dimension)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="budget-panel__empty">{t("notEvaluated")}</p>
                    )}
                  </section>

                  <section className="budget-panel__section">
                    <div className="budget-panel__section-head">
                      <h4>{t("definition")}</h4>
                      <p>{t("definitionHint")}</p>
                    </div>
                    <div className="budget-panel__definition">
                      {[
                        ["scope", selectedRule.scope],
                        ["agentId", selectedRule.agentId ?? "—"],
                        ["taskId", selectedRule.taskId ?? "—"],
                        ["dimension", selectedRule.dimension],
                        ["period", selectedRule.period],
                        ["warnThreshold", String(selectedRule.warnThreshold ?? "—")],
                        ["overThreshold", String(selectedRule.overThreshold ?? "—")],
                        ["enabled", String(selectedRule.enabled)],
                      ].map(([label, value]) => (
                        <div className="budget-panel__definition-row" key={label}>
                          <span>{label}</span>
                          <code>{value}</code>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="budget-panel__section">
                    <div className="budget-panel__section-head">
                      <h4>{t("recentChanges")}</h4>
                      <p>{t("recentChangesHint")}</p>
                    </div>
                    {selectedRuleChanges.length > 0 ? (
                      <div className="budget-panel__change-list">
                        {selectedRuleChanges.map((change) => (
                          <article className="budget-panel__change-row" key={change.id}>
                            <div className="budget-panel__status-head">
                              <span className="budget-panel__pill">{t(change.kind)}</span>
                              <span className="budget-panel__meta">{change.timestamp}</span>
                            </div>
                            <p className="budget-panel__note">{change.note}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="budget-panel__empty">{t("noRecentChanges")}</p>
                    )}
                  </section>
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
        </main>
      </div>
      {dialog ? (
        <BudgetDialogModal
          dialog={dialog}
          saving={saving}
          onClose={() => setDialog(null)}
          onSave={handleSave}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ) : null}
    </section>
  );
}

function BudgetDialogModal(props: {
  dialog: NonNullable<BudgetDialog>;
  saving: boolean;
  onClose: () => void;
  onSave: (input: BudgetRuleInput) => Promise<void>;
  onToggle: (rule: DeckGoBudgetRule) => Promise<void>;
  onDelete: (ruleId: string) => Promise<void>;
}) {
  const t = useTranslations("budget");
  const tc = useTranslations("common");
  const toggleRule = props.dialog.type === "toggle" ? props.dialog.rule : null;
  const deleteRule = props.dialog.type === "delete" ? props.dialog.rule : null;
  const title =
    props.dialog.type === "create"
      ? t("addRule")
      : props.dialog.type === "edit"
        ? t("editRule")
        : props.dialog.type === "toggle"
          ? props.dialog.rule.enabled
            ? t("disableRule")
            : t("enableRule")
          : t("deleteRule");

  return (
    <div className="budget-panel__modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        aria-label={title}
        aria-modal="true"
        className={`budget-panel__modal budget-panel__modal--${props.dialog.type}`}
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="budget-panel__modal-head">
          <div>
            <p className="budget-panel__eyebrow">{t("budgetRule")}</p>
            <h3 className="budget-panel__card-title">{title}</h3>
          </div>
          <button className="budget-panel__button" type="button" onClick={props.onClose}>
            {tc("close")}
          </button>
        </div>

        {props.dialog.type === "create" || props.dialog.type === "edit" ? (
          <RuleForm
            rule={props.dialog.type === "edit" ? props.dialog.rule : null}
            saving={props.saving}
            onSave={props.onSave}
            onCancel={props.onClose}
          />
        ) : null}

        {toggleRule ? (
          <div className="budget-panel__modal-body">
            <p className="budget-panel__note">
              {toggleRule.enabled
                ? t("disableWarning", { name: toggleRule.name })
                : t("enableWarning", { name: toggleRule.name })}
            </p>
            <div className="budget-panel__actions">
              <button
                className="budget-panel__button is-primary"
                disabled={props.saving}
                type="button"
                onClick={() => void props.onToggle(toggleRule)}
              >
                {toggleRule.enabled ? t("disableRule") : t("enableRule")}
              </button>
              <button className="budget-panel__button" type="button" onClick={props.onClose}>
                {tc("cancel")}
              </button>
            </div>
          </div>
        ) : null}

        {deleteRule ? (
          <div className="budget-panel__modal-body">
            <p className="budget-panel__note is-danger">{t("deleteWarning")}</p>
            <p className="budget-panel__note">{deleteRule.name}</p>
            <div className="budget-panel__actions">
              <button
                className="budget-panel__button is-danger"
                disabled={props.saving}
                type="button"
                onClick={() => void props.onDelete(deleteRule.id)}
              >
                {t("confirmDelete")}
              </button>
              <button className="budget-panel__button" type="button" onClick={props.onClose}>
                {tc("cancel")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
