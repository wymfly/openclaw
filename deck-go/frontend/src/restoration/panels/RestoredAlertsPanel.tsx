import { useEffect, useMemo, useState } from "react";
import type { DeckGoAlertAction, DeckGoAlertRule } from "../../api";
import { createAlertRule, deleteAlertRule, fetchAlertRules, updateAlertRule } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

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

export function RestoredAlertsPanel() {
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
        nextRules.some((rule) => rule.id === current)
          ? current
          : nextRules.some((rule) => rule.id === fallbackId)
            ? fallbackId
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
      const result = await createAlertRule({
        name: draft.name,
        entityType: draft.entityType,
        condition: draft.condition,
        threshold: Number(draft.threshold),
        action: draft.action,
        cooldownMs: Number(draft.cooldownMs),
        enabled: draft.enabled,
      });
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
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Alert rules</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Bounded Vite-owned alerts slice: rule inventory plus create/enable/delete actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Alerts {loadState}
              </span>
              <span className="deckgo-pill">{rules.length} rules</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2">
              <ShellStat label="rules" value={rules.length} />
              <ShellStat label="enabled" value={enabledCount} />
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Create rule</p>
              <div className="deckgo-grid deckgo-grid-2">
                <input
                  className="deckgo-input"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="name"
                />
                <input
                  className="deckgo-input"
                  value={draft.entityType}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, entityType: event.target.value }))
                  }
                  placeholder="entity type"
                />
                <input
                  className="deckgo-input"
                  value={draft.condition}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, condition: event.target.value }))
                  }
                  placeholder="condition"
                />
                <input
                  className="deckgo-input"
                  value={draft.threshold}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, threshold: event.target.value }))
                  }
                  placeholder="threshold"
                />
                <select
                  className="deckgo-input"
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
                  className="deckgo-input"
                  value={draft.cooldownMs}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, cooldownMs: event.target.value }))
                  }
                  placeholder="cooldown ms"
                />
              </div>
              <div className="deckgo-actions" style={{ marginTop: 12 }}>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refresh(selectedRuleId)}
                >
                  Refresh alerts
                </button>
                <button
                  className="deckgo-button is-primary"
                  type="button"
                  onClick={() => void createAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "creating" ? "Creating" : "Create rule"}
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {rules.length === 0 ? (
              <p className="deckgo-note">No alert rules loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {rules.map((rule) => (
                  <li key={rule.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedRule?.id === rule.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedRuleId(rule.id)}
                    >
                      <strong>{rule.name}</strong>
                      <div className="deckgo-meta">
                        {rule.entityType} {rule.condition} {rule.threshold} | action: {rule.action}
                      </div>
                      <div className="deckgo-meta">enabled: {rule.enabled ? "yes" : "no"}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected rule</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice stays narrow and operational: inspect a rule, toggle it, or delete it.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedRule ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Rule</p>
                    <strong>{selectedRule.name}</strong>
                    <p className="deckgo-note">
                      {selectedRule.entityType} {selectedRule.condition} {selectedRule.threshold}
                    </p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">{selectedRule.action}</span>
                    <span className="deckgo-pill">
                      {selectedRule.enabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="cooldown" value={selectedRule.cooldownMs} />
                  <ShellStat label="last fired" value={selectedRule.lastFiredAt || "never"} />
                </div>
                <div className="deckgo-actions">
                  <button
                    className="deckgo-button"
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
                    className="deckgo-button is-danger"
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
              <p className="deckgo-note">Choose an alert rule to inspect it.</p>
            )}
            {actionResult ? <JsonDetails title="Last alert action" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
