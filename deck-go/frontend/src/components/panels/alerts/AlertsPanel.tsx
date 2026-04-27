import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckGoAlertRule } from "../../../api";
import { createAlertRule, deleteAlertRule, fetchAlertRules, updateAlertRule } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { FiredAlertsList } from "./FiredAlertsList";
import { RuleForm, type AlertRuleInput } from "./RuleForm";
import { RuleList } from "./RuleList";

type PanelState = "idle" | "loading" | "ready";
type Tab = "rules" | "fired";

export function AlertsPanel() {
  const t = useTranslations("alerts");
  const tc = useTranslations("common");
  const [rules, setRules] = useState<DeckGoAlertRule[]>([]);
  const [tab, setTab] = useState<Tab>("rules");
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<DeckGoAlertRule | undefined>();
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const enabledCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);

  const refresh = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetchAlertRules();
      setRules(response.rules ?? []);
      setLoadState("ready");
      setError("");
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : t("loadRulesFailed"));
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubmit = async (input: AlertRuleInput) => {
    setSaving(true);
    try {
      if (editingRule) {
        await updateAlertRule(editingRule.id, input);
      } else {
        await createAlertRule(input);
      }
      await refresh();
      setShowForm(false);
      setEditingRule(undefined);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("saveRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: DeckGoAlertRule) => {
    if (!window.confirm(t("confirmDelete"))) {
      return;
    }
    setSaving(true);
    try {
      await deleteAlertRule(rule.id);
      await refresh();
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: DeckGoAlertRule, enabled: boolean) => {
    setSaving(true);
    try {
      await updateAlertRule(rule.id, { enabled });
      await refresh();
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("saveRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="deck-ui-control-single deck-ui-alerts">
      <header className="deck-ui-control-topbar">
        <div className="deck-ui-control-tabs" role="tablist" aria-label={t("title")}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rules"}
            className={tab === "rules" ? "is-selected" : ""}
            onClick={() => {
              setTab("rules");
              setShowForm(false);
              setEditingRule(undefined);
            }}
          >
            {t("title")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "fired"}
            className={tab === "fired" ? "is-selected" : ""}
            onClick={() => {
              setTab("fired");
              setShowForm(false);
              setEditingRule(undefined);
            }}
          >
            {t("firedAlerts")}
          </button>
        </div>

        <div className="deck-ui-control-topbar-actions">
          <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
            {loadState === "loading" ? tc("loading") : t(loadState)}
          </span>
          <span className="deckgo-pill">{t("ruleCount", { count: rules.length })}</span>
          <span className="deckgo-pill">{t("enabledCount", { count: enabledCount })}</span>
          {tab === "rules" && !showForm ? (
            <button
              className="deckgo-button is-primary deck-ui-alerts-button"
              type="button"
              onClick={() => {
                setEditingRule(undefined);
                setShowForm(true);
              }}
            >
              {t("addRule")}
            </button>
          ) : null}
        </div>
      </header>

      <div className="deck-ui-control-panel-body">
        {error ? <p className="deck-ui-control-error">{error}</p> : null}
        {loadState === "loading" && rules.length === 0 ? (
          <p className="deck-ui-control-empty">{tc("loading")}</p>
        ) : null}

        {tab === "rules" && !showForm ? (
          <RuleList
            rules={rules}
            onEdit={(rule) => {
              setEditingRule(rule);
              setShowForm(true);
            }}
            onDelete={(rule) => void handleDelete(rule)}
            onToggle={(rule, enabled) => void handleToggle(rule, enabled)}
          />
        ) : null}

        {tab === "rules" && showForm ? (
          <RuleForm
            key={editingRule?.id ?? "new-alert-rule"}
            rule={editingRule}
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingRule(undefined);
            }}
          />
        ) : null}

        {tab === "fired" ? <FiredAlertsList rules={rules} /> : null}
      </div>
    </section>
  );
}
