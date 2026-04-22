import { useEffect, useState } from "react";
import type { DeckGoAgentDetailResponse, DeckGoAgentSummary } from "../../api";
import {
  createAgent,
  deleteAgent,
  fetchAgentDetail,
  fetchAgentsList,
  updateAgent,
} from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

type CreateDraft = {
  name: string;
  workspace: string;
  emoji: string;
};

const DEFAULT_CREATE_DRAFT: CreateDraft = {
  name: "",
  workspace: "",
  emoji: "",
};

export function RestoredAgentsPanel() {
  const [agents, setAgents] = useState<DeckGoAgentSummary[]>([]);
  const [defaultAgentId, setDefaultAgentId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [detail, setDetail] = useState<DeckGoAgentDetailResponse | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [createDraft, setCreateDraft] = useState(DEFAULT_CREATE_DRAFT);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<
    "idle" | "detail" | "creating" | "renaming" | "deleting"
  >("idle");
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);

  const loadDetail = async (agentId: string) => {
    setActionState("detail");
    try {
      const nextDetail = await fetchAgentDetail(agentId);
      setDetail(nextDetail);
      setRenameValue(nextDetail.name || agentId);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "failed to load agent detail");
    } finally {
      setActionState("idle");
    }
  };

  const refresh = async (preferredAgentId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchAgentsList();
      const nextAgents = (next.agents ?? [])
        .slice()
        .sort((left, right) => left.id.localeCompare(right.id));
      setAgents(nextAgents);
      setDefaultAgentId(next.defaultId ?? "");
      setLoadState("ready");
      setError("");
      const fallbackId = preferredAgentId?.trim() || next.defaultId || nextAgents[0]?.id || "";
      const nextSelectedAgentId = nextAgents.some((agent) => agent.id === selectedAgentId)
        ? selectedAgentId
        : nextAgents.some((agent) => agent.id === fallbackId)
          ? fallbackId
          : nextAgents[0]?.id || "";
      setSelectedAgentId(nextSelectedAgentId);
      if (nextSelectedAgentId) {
        await loadDetail(nextSelectedAgentId);
      } else {
        setDetail(null);
        setRenameValue("");
      }
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load agents");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null;

  const selectAgent = async (agentId: string) => {
    setSelectedAgentId(agentId);
    await loadDetail(agentId);
  };

  const createAction = async () => {
    if (!createDraft.name.trim()) {
      setError("agent name is required");
      return;
    }
    setActionState("creating");
    try {
      const result = await createAgent({
        name: createDraft.name.trim(),
        workspace: createDraft.workspace.trim() || undefined,
        emoji: createDraft.emoji.trim() || undefined,
      });
      setActionResult(result);
      setCreateDraft(DEFAULT_CREATE_DRAFT);
      setError("");
      await refresh(result.id || createDraft.name.trim().toLowerCase());
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "agent create failed");
    } finally {
      setActionState("idle");
    }
  };

  const renameAction = async () => {
    if (!selectedAgent || !renameValue.trim()) {
      return;
    }
    setActionState("renaming");
    try {
      const result = await updateAgent(selectedAgent.id, { name: renameValue.trim() });
      setActionResult(result);
      setError("");
      await refresh(selectedAgent.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "agent rename failed");
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!selectedAgent) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteAgent(selectedAgent.id);
      setActionResult(result);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "agent delete failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Agents</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned agent inventory surface over list, create, rename, delete, and detail.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Agents {loadState}
              </span>
              <span className="deckgo-pill">{agents.length} loaded</span>
              <span className="deckgo-pill">default {defaultAgentId || "n/a"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="agents" value={agents.length} />
              <ShellStat label="default" value={defaultAgentId || "n/a"} />
              <ShellStat label="selected" value={selectedAgent?.id || "n/a"} />
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Create agent</p>
              <div className="deckgo-grid deckgo-grid-2">
                <input
                  className="deckgo-input"
                  value={createDraft.name}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="agent name"
                />
                <input
                  className="deckgo-input"
                  value={createDraft.workspace}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, workspace: event.target.value }))
                  }
                  placeholder="workspace (optional)"
                />
                <input
                  className="deckgo-input"
                  value={createDraft.emoji}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, emoji: event.target.value }))
                  }
                  placeholder="emoji (optional)"
                />
              </div>
              <div className="deckgo-actions" style={{ marginTop: 12 }}>
                <button
                  className="deckgo-button is-primary"
                  type="button"
                  onClick={() => void createAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "creating" ? "Creating" : "Create agent"}
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refresh(selectedAgentId)}
                >
                  Refresh agents
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {agents.length === 0 ? (
              <p className="deckgo-note">No agents loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {agents.map((agent) => (
                  <li key={agent.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedAgent?.id === agent.id ? "is-selected" : ""}`}
                      onClick={() => void selectAgent(agent.id)}
                    >
                      <strong>{agent.name || agent.id}</strong>
                      <div className="deckgo-meta">
                        id: {agent.id} | workspace:{" "}
                        {typeof agent.workspace === "string" ? agent.workspace : "n/a"}
                      </div>
                      <div className="deckgo-meta">
                        {agent.id === defaultAgentId ? "default agent" : "standard agent"}
                      </div>
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
            <h2 className="deckgo-card-title">Agent detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice keeps agent migration centered on inventory truth and the highest-signal
            operational detail, not on restoring the old tabbed agent cockpit in one step.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {detail ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Selected agent</p>
                    <strong>{detail.name || detail.id}</strong>
                    <p className="deckgo-note">{detail.workspace}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">{detail.model || "default model"}</span>
                    <span className="deckgo-pill">{detail.skillMode}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-3">
                  <ShellStat label="bindings" value={detail.bindingCount} />
                  <ShellStat label="sessions" value={detail.sessionCount} />
                  <ShellStat label="subagents" value={detail.activeSubagentCount} />
                </div>
                <div className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Rename or remove</p>
                  <div className="deckgo-actions">
                    <input
                      className="deckgo-input"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      placeholder="agent name"
                    />
                    <button
                      className="deckgo-button"
                      type="button"
                      onClick={() => void renameAction()}
                      disabled={actionState !== "idle"}
                    >
                      {actionState === "renaming" ? "Renaming" : "Rename"}
                    </button>
                    <button
                      className="deckgo-button is-danger"
                      type="button"
                      onClick={() => void deleteAction()}
                      disabled={actionState !== "idle" || detail.isDefault}
                    >
                      {actionState === "deleting" ? "Deleting" : "Delete"}
                    </button>
                  </div>
                </div>
                <JsonDetails title="Agent detail payload" payload={detail} />
              </>
            ) : (
              <p className="deckgo-note">Choose an agent to inspect it.</p>
            )}
            {actionResult ? <JsonDetails title="Last agent action" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
