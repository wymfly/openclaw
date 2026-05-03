import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckGoAlertRule } from "../../../api";
import { createAlertRule, deleteAlertRule, fetchAlertRules, updateAlertRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { AlertsMetric } from "./AlertsMetric";
import { FiredAlertsList } from "./FiredAlertsList";
import { RuleForm, type AlertRuleInput } from "./RuleForm";
import { RuleList } from "./RuleList";
import "./alerts-panel.css";

type PanelState = "idle" | "loading" | "ready";
type ViewMode = "detail" | "form" | "fired";
type LastAction = "created" | "updated" | "deleted" | "toggled" | null;

function formatCooldown(cooldownMs: number) {
  return Math.round(cooldownMs / 60_000);
}

export function AlertsPanel() {
  const t = useTranslations("alerts");
  const tc = useTranslations("common");
  const [rules, setRules] = useState<DeckGoAlertRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("detail");
  const [editingRule, setEditingRule] = useState<DeckGoAlertRule | undefined>();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [saving, setSaving] = useState(false);
  const [lastAction, setLastAction] = useState<LastAction>(null);
  const [error, setError] = useState("");

  const enabledCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);
  const webhookCount = useMemo(
    () => rules.filter((rule) => rule.action === "webhook").length,
    [rules],
  );
  const firedCount = useMemo(() => rules.filter((rule) => rule.lastFiredAt).length, [rules]);
  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId],
  );

  const refresh = useCallback(
    async (preferredRuleId?: string) => {
      setLoadState("loading");
      try {
        const response = await fetchAlertRules();
        const nextRules = response.rules ?? [];
        setRules(nextRules);
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

  const handleSelect = (rule: DeckGoAlertRule) => {
    setSelectedRuleId(rule.id);
    setEditingRule(undefined);
    setConfirmDeleteId(null);
    setViewMode("detail");
  };

  const handleEdit = (rule: DeckGoAlertRule) => {
    setSelectedRuleId(rule.id);
    setEditingRule(rule);
    setConfirmDeleteId(null);
    setViewMode("form");
  };

  const handleCreate = () => {
    setEditingRule(undefined);
    setConfirmDeleteId(null);
    setViewMode("form");
  };

  const handleSubmit = async (input: AlertRuleInput) => {
    setSaving(true);
    try {
      const result = editingRule
        ? await updateAlertRule(editingRule.id, input)
        : await createAlertRule(input);
      await refresh(result.rule.id);
      setLastAction(editingRule ? "updated" : "created");
      setViewMode("detail");
      setEditingRule(undefined);
      setConfirmDeleteId(null);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("saveRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: DeckGoAlertRule) => {
    setSaving(true);
    try {
      await deleteAlertRule(rule.id);
      await refresh();
      setLastAction("deleted");
      setViewMode("detail");
      setEditingRule(undefined);
      setConfirmDeleteId(null);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: DeckGoAlertRule) => {
    setSaving(true);
    try {
      const result = await updateAlertRule(rule.id, { enabled: !rule.enabled });
      await refresh(result.rule.id);
      setLastAction("toggled");
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("saveRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="alerts-panel" data-testid="alerts-panel">
      <header className="alerts-panel__header">
        <div className="alerts-panel__title-stack">
          <p className="alerts-panel__eyebrow">{t("eyebrow")}</p>
          <h2 className="alerts-panel__title">{t("title")}</h2>
          <p className="alerts-panel__description">{t("subtitle")}</p>
        </div>
        <div className="alerts-panel__header-actions">
          <button
            className="alerts-panel__button"
            type="button"
            disabled={loadState === "loading"}
            onClick={() => void refresh(selectedRuleId ?? undefined)}
          >
            {t("refresh")}
          </button>
          <button
            className="alerts-panel__button"
            type="button"
            onClick={() => {
              setViewMode("fired");
              setEditingRule(undefined);
              setConfirmDeleteId(null);
            }}
          >
            {t("firedAlerts")}
          </button>
          <button className="alerts-panel__button is-primary" type="button" onClick={handleCreate}>
            {t("addRule")}
          </button>
        </div>
      </header>

      <div className="alerts-panel__metrics">
        <AlertsMetric
          label={t("ruleMetric")}
          value={String(rules.length)}
          tone={rules.length > 0 ? "positive" : "neutral"}
        />
        <AlertsMetric label={t("enabledMetric")} value={String(enabledCount)} tone="positive" />
        <AlertsMetric
          label={t("webhookMetric")}
          value={String(webhookCount)}
          tone={webhookCount > 0 ? "warning" : "neutral"}
        />
        <AlertsMetric
          label={t("firedMetric")}
          value={String(firedCount)}
          tone={firedCount > 0 ? "danger" : "neutral"}
        />
      </div>

      {error ? <p className="alerts-panel__error">{error}</p> : null}

      <div className="alerts-panel__workspace">
        <aside className="alerts-panel__card">
          <div className="alerts-panel__card-head">
            <div>
              <h3 className="alerts-panel__card-title">{t("ruleInventory")}</h3>
              <p className="alerts-panel__meta">
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </p>
            </div>
            <div className="alerts-panel__pill-row">
              <span className={`alerts-panel__pill ${loadState === "ready" ? "is-positive" : ""}`}>
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </span>
              <span className="alerts-panel__pill">{t("ruleCount", { count: rules.length })}</span>
            </div>
          </div>

          <div className="alerts-panel__body">
            {loadState === "loading" && rules.length === 0 ? (
              <p className="alerts-panel__empty">{tc("loading")}</p>
            ) : (
              <RuleList rules={rules} selectedRuleId={selectedRuleId} onSelect={handleSelect} />
            )}
          </div>
        </aside>

        <main className="alerts-panel__column">
          {viewMode === "form" ? (
            <section className="alerts-panel__card">
              <div className="alerts-panel__card-head">
                <div>
                  <h3 className="alerts-panel__card-title">
                    {editingRule ? t("editRule") : t("addRule")}
                  </h3>
                  <p className="alerts-panel__meta">{t("formDescription")}</p>
                </div>
              </div>
              <div className="alerts-panel__body">
                <RuleForm
                  key={editingRule?.id ?? "new-alert-rule"}
                  rule={editingRule}
                  saving={saving}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    setViewMode("detail");
                    setEditingRule(undefined);
                    setConfirmDeleteId(null);
                  }}
                />
              </div>
            </section>
          ) : null}

          {viewMode === "fired" ? <FiredAlertsList rules={rules} /> : null}

          {viewMode === "detail" ? (
            <section className="alerts-panel__card">
              <div className="alerts-panel__card-head">
                <div>
                  <h3 className="alerts-panel__card-title">{t("selectedRule")}</h3>
                  <p className="alerts-panel__meta">
                    {selectedRule ? t("policyEvidence") : t("noSelection")}
                  </p>
                </div>
                {selectedRule ? (
                  <div className="alerts-panel__actions">
                    <button
                      className="alerts-panel__button"
                      type="button"
                      disabled={saving}
                      onClick={() => void handleToggle(selectedRule)}
                    >
                      {selectedRule.enabled ? t("disableRule") : t("enableRule")}
                    </button>
                    <button
                      className="alerts-panel__button"
                      type="button"
                      onClick={() => handleEdit(selectedRule)}
                    >
                      {t("editRule")}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="alerts-panel__body alerts-panel__detail-stack">
                {selectedRule ? (
                  <>
                    <div className="alerts-panel__hero">
                      <div>
                        <p className="alerts-panel__eyebrow">{t("selected")}</p>
                        <strong>{selectedRule.name}</strong>
                        <p className="alerts-panel__meta">
                          {selectedRule.entityType} · {selectedRule.condition}{" "}
                          {selectedRule.threshold}
                        </p>
                      </div>
                      <div className="alerts-panel__pill-row">
                        <span
                          className={`alerts-panel__pill ${
                            selectedRule.enabled ? "is-positive" : "is-muted"
                          }`}
                        >
                          {selectedRule.enabled ? t("enabled") : t("disabled")}
                        </span>
                        <span
                          className={`alerts-panel__pill ${
                            selectedRule.action === "webhook" ? "is-warning" : ""
                          }`}
                        >
                          {t(selectedRule.action)}
                        </span>
                      </div>
                    </div>

                    <div className="alerts-panel__field-grid">
                      <div className="alerts-panel__surface">
                        <p className="alerts-panel__label">{t("triggerExpression")}</p>
                        <strong>
                          {selectedRule.entityType} {selectedRule.condition}{" "}
                          {selectedRule.threshold}
                        </strong>
                      </div>
                      <div className="alerts-panel__surface">
                        <p className="alerts-panel__label">{t("actionDelivery")}</p>
                        <strong>{t(selectedRule.action)}</strong>
                        <p className="alerts-panel__meta">
                          {t("cooldown")}: {formatCooldown(selectedRule.cooldownMs)}{" "}
                          {t("cooldownMinutes")}
                        </p>
                      </div>
                      <div className="alerts-panel__surface">
                        <p className="alerts-panel__label">{t("lastFired")}</p>
                        <strong>{selectedRule.lastFiredAt ?? t("never")}</strong>
                      </div>
                      <div className="alerts-panel__surface">
                        <p className="alerts-panel__label">{t("updatedAt")}</p>
                        <strong>{selectedRule.updatedAt || t("notAvailable")}</strong>
                      </div>
                    </div>

                    <div className="alerts-panel__actions">
                      {confirmDeleteId === selectedRule.id ? (
                        <>
                          <button
                            className="alerts-panel__button is-danger"
                            disabled={saving}
                            type="button"
                            onClick={() => void handleDelete(selectedRule)}
                          >
                            {t("confirmDeleteAction")}
                          </button>
                          <button
                            className="alerts-panel__button"
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            {tc("cancel")}
                          </button>
                        </>
                      ) : (
                        <button
                          className="alerts-panel__button is-danger"
                          disabled={saving}
                          type="button"
                          onClick={() => setConfirmDeleteId(selectedRule.id)}
                        >
                          {t("deleteRule")}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="alerts-panel__surface">
                    <h3 className="alerts-panel__card-title">{t("noRules")}</h3>
                    <p className="alerts-panel__note">{t("emptyDescription")}</p>
                  </div>
                )}
                {lastAction ? (
                  <p className="alerts-panel__note">
                    {t("lastAction")}: {t(lastAction)}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </section>
  );
}
