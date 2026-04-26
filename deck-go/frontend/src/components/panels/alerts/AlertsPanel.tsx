import { useEffect, useMemo, useState } from "react";
import type { DeckGoAlertAction, DeckGoAlertRule } from "../../../api";
import { createAlertRule, deleteAlertRule, fetchAlertRules, updateAlertRule } from "../../../api";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";
type AlertEntityType = "usage" | "cron" | "approval" | "agent";

type RuleDraft = {
  name: string;
  entityType: string;
  condition: string;
  threshold: string;
  action: DeckGoAlertAction;
  cooldownMs: string;
  enabled: boolean;
};

const DEFAULT_DRAFT: RuleDraft = {
  name: "",
  entityType: "usage",
  condition: ">=",
  threshold: "80",
  action: "toast",
  cooldownMs: "60000",
  enabled: true,
};

const ALERT_ENTITY_TYPES: AlertEntityType[] = ["usage", "cron", "approval", "agent"];

function normalizeAlertEntityType(value: string): AlertEntityType {
  return ALERT_ENTITY_TYPES.includes(value as AlertEntityType)
    ? (value as AlertEntityType)
    : "usage";
}

function formatCooldownMinutes(cooldownMs: number) {
  return `${Math.round(cooldownMs / 60_000)}m`;
}

function cooldownMinutesFromDraft(draft: RuleDraft) {
  const cooldownMs = Number(draft.cooldownMs);
  return Number.isFinite(cooldownMs) ? String(Math.round(cooldownMs / 60_000)) : "";
}

function cooldownMsFromMinutes(value: string) {
  const minutes = Number(value);
  return Number.isFinite(minutes) ? String(Math.max(0, minutes) * 60_000) : "";
}

function alertInputFromDraft(draft: RuleDraft) {
  return {
    name: draft.name,
    entityType: normalizeAlertEntityType(draft.entityType),
    condition: draft.condition,
    threshold: Number(draft.threshold),
    action: draft.action,
    cooldownMs: Number(draft.cooldownMs),
    enabled: draft.enabled,
  };
}

function draftFromRule(rule: DeckGoAlertRule): RuleDraft {
  return {
    name: rule.name,
    entityType: normalizeAlertEntityType(rule.entityType),
    condition: rule.condition,
    threshold: String(rule.threshold),
    action: rule.action,
    cooldownMs: String(rule.cooldownMs),
    enabled: rule.enabled,
  };
}

export function AlertsPanel() {
  const [rules, setRules] = useState<DeckGoAlertRule[]>([]);
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
      const next = await fetchAlertRules();
      const nextRules = next.rules ?? [];
      setRules(nextRules);
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
      setError(loadError instanceof Error ? loadError.message : "failed to load alert rules");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const selectedRule = rules.find((rule) => rule.id === selectedRuleId) ?? rules[0] ?? null;
  const enabledCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);

  const createAction = async () => {
    setActionState("creating");
    try {
      const result = await createAlertRule(alertInputFromDraft(draft));
      setActionResult(result);
      setError("");
      setDraft(DEFAULT_DRAFT);
      await refresh(result.rule.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "alert rule create failed");
    } finally {
      setActionState("idle");
    }
  };

  const updateSelectedAction = async () => {
    if (!selectedRule) {
      return;
    }
    setActionState("updating");
    try {
      const result = await updateAlertRule(selectedRule.id, alertInputFromDraft(draft));
      setActionResult(result);
      setError("");
      await refresh(selectedRule.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "alert rule update failed");
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
      const result = await updateAlertRule(selectedRule.id, { enabled });
      setActionResult(result);
      setError("");
      await refresh(selectedRule.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "alert rule update failed");
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!selectedRule) {
      return;
    }
    if (!window.confirm(`Delete alert rule ${selectedRule.id}?`)) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteAlertRule(selectedRule.id);
      setActionResult(result);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "alert rule delete failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-alerts">
      <div className="deckgo-column deck-ui-alerts-column">
        <article className="deckgo-card is-float deck-ui-alerts-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Alert rules</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Alert rules support inventory, create, enable/disable, and delete actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-alerts-body">
            <div className="deckgo-pill-row deck-ui-alerts-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Alerts {loadState}
              </span>
              <span className="deckgo-pill">{rules.length} rules</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2 deck-ui-alerts-stats">
              <ShellStat label="rules" value={rules.length} />
              <ShellStat label="enabled" value={enabledCount} />
            </div>
            <div className="deckgo-surface-tile deck-ui-alerts-surface">
              <p className="deckgo-surface-label">Create rule</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-alerts-form-grid">
                <input
                  aria-label="alert rule name"
                  className="deckgo-input deck-ui-alerts-input"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="name"
                />
                <select
                  aria-label="alert entity type"
                  className="deckgo-input deck-ui-alerts-input"
                  value={draft.entityType}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, entityType: event.target.value }))
                  }
                >
                  {ALERT_ENTITY_TYPES.map((entityType) => (
                    <option key={entityType} value={entityType}>
                      {entityType}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="alert condition"
                  className="deckgo-input deck-ui-alerts-input"
                  value={draft.condition}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, condition: event.target.value }))
                  }
                  placeholder="condition"
                />
                <input
                  aria-label="alert threshold"
                  className="deckgo-input deck-ui-alerts-input"
                  value={draft.threshold}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, threshold: event.target.value }))
                  }
                  placeholder="threshold"
                />
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
                  <option value="toast">toast</option>
                  <option value="activity">activity</option>
                  <option value="webhook">webhook</option>
                </select>
                <input
                  aria-label="alert cooldown minutes"
                  className="deckgo-input deck-ui-alerts-input"
                  value={cooldownMinutesFromDraft(draft)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      cooldownMs: cooldownMsFromMinutes(event.target.value),
                    }))
                  }
                  placeholder="cooldown minutes"
                />
              </div>
              <label className="deckgo-label deck-ui-alerts-check">
                <span>Rule enabled</span>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
              </label>
              <div className="deckgo-actions deck-ui-alerts-actions deck-ui-alerts-actions-offset">
                <button
                  className="deckgo-button deck-ui-alerts-button"
                  type="button"
                  onClick={() => void refresh(selectedRuleId)}
                >
                  Refresh alerts
                </button>
                <button
                  className="deckgo-button is-primary deck-ui-alerts-button"
                  type="button"
                  onClick={() => void createAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "creating" ? "Creating" : "Create rule"}
                </button>
                <button
                  className="deckgo-button deck-ui-alerts-button"
                  type="button"
                  onClick={() => selectedRule && setDraft(draftFromRule(selectedRule))}
                  disabled={!selectedRule || actionState !== "idle"}
                >
                  Load selected
                </button>
                <button
                  className="deckgo-button deck-ui-alerts-button"
                  type="button"
                  onClick={() => void updateSelectedAction()}
                  disabled={!selectedRule || actionState !== "idle"}
                >
                  {actionState === "updating" ? "Saving" : "Save selected"}
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note deck-ui-alerts-error">{error}</p> : null}
            {rules.length === 0 ? (
              <p className="deckgo-note deck-ui-alerts-empty">No alert rules loaded.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-alerts-list">
                {rules.map((rule) => (
                  <li key={rule.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-alerts-row ${selectedRule?.id === rule.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedRuleId(rule.id)}
                    >
                      <strong>{rule.name}</strong>
                      <div className="deckgo-meta">
                        {rule.entityType} {rule.condition} {rule.threshold} | action: {rule.action}
                      </div>
                      <div className="deckgo-meta">enabled: {rule.enabled ? "yes" : "no"}</div>
                      <div className="deckgo-pill-row deck-ui-alerts-status-row">
                        <span
                          className={`deckgo-pill ${rule.enabled ? "is-positive" : "is-muted"}`}
                        >
                          {rule.enabled ? "enabled" : "disabled"}
                        </span>
                        <span className="deckgo-pill">action {rule.action}</span>
                        <span className="deckgo-pill">
                          cooldown {formatCooldownMinutes(rule.cooldownMs)}
                        </span>
                        <span className="deckgo-pill">
                          last fired {rule.lastFiredAt || "never"}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-alerts-column">
        <article className="deckgo-card is-float deck-ui-alerts-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected rule</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Inspect a rule, toggle it, update it, or delete it from current alert-rule state.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-alerts-body">
            {selectedRule ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-alerts-hero">
                  <div>
                    <p className="deckgo-kicker">Rule</p>
                    <strong>{selectedRule.name}</strong>
                    <p className="deckgo-note">
                      {selectedRule.entityType} {selectedRule.condition} {selectedRule.threshold}
                    </p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-alerts-status-row">
                    <span className="deckgo-pill">{selectedRule.action}</span>
                    <span className="deckgo-pill">
                      {selectedRule.enabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-alerts-detail-stats">
                  <ShellStat label="cooldown" value={selectedRule.cooldownMs} />
                  <ShellStat label="last fired" value={selectedRule.lastFiredAt || "never"} />
                </div>
                <div className="deckgo-actions deck-ui-alerts-actions">
                  <button
                    className="deckgo-button deck-ui-alerts-button"
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
                    className="deckgo-button is-danger deck-ui-alerts-button"
                    type="button"
                    onClick={() => void deleteAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "deleting" ? "Deleting" : "Delete"}
                  </button>
                </div>
                <JsonDetails title="Rule payload" payload={selectedRule} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-alerts-empty">
                Choose an alert rule to inspect it.
              </p>
            )}
            {actionResult ? <JsonDetails title="Last alert action" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
