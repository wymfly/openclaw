import { useEffect, useState } from "react";
import type { DeckGoBudgetEvaluation, DeckGoBudgetRule } from "../../api";
import {
  createBudgetRule,
  deleteBudgetRule,
  evaluateBudgetRules,
  fetchBudgetRules,
  updateBudgetRule,
} from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

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

export function RestoredBudgetPanel() {
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
        nextRules.some((rule) => rule.id === current)
          ? current
          : nextRules.some((rule) => rule.id === fallbackId)
            ? fallbackId
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

  const createAction = async () => {
    setActionState("creating");
    try {
      const result = await createBudgetRule({
        name: draft.name,
        scope: draft.scope,
        agentId: draft.agentId || null,
        taskId: draft.taskId || null,
        dimension: draft.dimension,
        warnThreshold: draft.warnThreshold ? Number(draft.warnThreshold) : null,
        overThreshold: draft.overThreshold ? Number(draft.overThreshold) : null,
        period: draft.period,
        enabled: draft.enabled,
      });
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
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Budget rules</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned budget slice with rule inventory and evaluation snapshots.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Budget {loadState}
              </span>
              <span className="deckgo-pill">{rules.length} rules</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2">
              <ShellStat label="rules" value={rules.length} />
              <ShellStat label="evaluations" value={evaluations.length} />
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
                  value={draft.scope}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, scope: event.target.value }))
                  }
                  placeholder="scope"
                />
                <input
                  className="deckgo-input"
                  value={draft.agentId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, agentId: event.target.value }))
                  }
                  placeholder="agent id"
                />
                <input
                  className="deckgo-input"
                  value={draft.taskId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, taskId: event.target.value }))
                  }
                  placeholder="task id"
                />
                <select
                  className="deckgo-input"
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
                <input
                  className="deckgo-input"
                  value={draft.period}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, period: event.target.value }))
                  }
                  placeholder="period"
                />
                <input
                  className="deckgo-input"
                  value={draft.warnThreshold}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, warnThreshold: event.target.value }))
                  }
                  placeholder="warn threshold"
                />
                <input
                  className="deckgo-input"
                  value={draft.overThreshold}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, overThreshold: event.target.value }))
                  }
                  placeholder="over threshold"
                />
              </div>
              <div className="deckgo-actions" style={{ marginTop: 12 }}>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refresh(selectedRuleId)}
                >
                  Refresh budget
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
              <p className="deckgo-note">No budget rules loaded.</p>
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
                        {rule.dimension} | warn: {rule.warnThreshold ?? "n/a"} | over:{" "}
                        {rule.overThreshold ?? "n/a"}
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
            This slice focuses on rule truth and current evaluations, not yet on richer analysis
            flows.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedRule ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Rule</p>
                    <strong>{selectedRule.name}</strong>
                    <p className="deckgo-note">
                      {selectedRule.scope} · {selectedRule.period}
                    </p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">{selectedRule.dimension}</span>
                    <span className="deckgo-pill">
                      {selectedRule.enabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="warn" value={selectedRule.warnThreshold ?? "n/a"} />
                  <ShellStat label="over" value={selectedRule.overThreshold ?? "n/a"} />
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
                {selectedEvaluation ? (
                  <JsonDetails title="Evaluation" payload={selectedEvaluation} />
                ) : null}
                <JsonDetails title="Rule payload" payload={selectedRule} />
              </>
            ) : (
              <p className="deckgo-note">Choose a budget rule to inspect it.</p>
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
