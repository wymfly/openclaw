import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoSubagentLineageNode,
  DeckGoSubagentRun,
  DeckGoSubagentsLineageResponse,
} from "../../api";
import {
  fetchSubagentLineage,
  fetchSubagentRuns,
  killSubagentRun,
  steerSubagentRun,
} from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

type RunsFilter = {
  requesterAgentId: string;
  status: "active" | "all";
};

type LineageTreeNode = {
  node: DeckGoSubagentLineageNode;
  children: LineageTreeNode[];
};

const DEFAULT_FILTERS: RunsFilter = {
  requesterAgentId: "",
  status: "active",
};

function formatTimestamp(value?: number) {
  if (!value) {
    return "n/a";
  }
  return new Date(value).toLocaleString();
}

function buildLineageTree(nodes: DeckGoSubagentLineageNode[]) {
  const childrenByParent = new Map<string, DeckGoSubagentLineageNode[]>();
  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentRunId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentRunId, siblings);
  }

  function build(parentRunId: string): LineageTreeNode[] {
    const children = (childrenByParent.get(parentRunId) ?? [])
      .slice()
      .toSorted((left, right) =>
        left.depth === right.depth
          ? left.runId.localeCompare(right.runId)
          : left.depth - right.depth,
      );
    return children.map((node) => ({
      node,
      children: build(node.runId),
    }));
  }

  const roots = nodes
    .filter((node) => !node.parentRunId)
    .slice()
    .toSorted((left, right) => left.runId.localeCompare(right.runId));
  return roots.map((node) => ({
    node,
    children: build(node.runId),
  }));
}

function LineageTreeView(props: { nodes: LineageTreeNode[] }) {
  if (props.nodes.length === 0) {
    return <p className="deckgo-note">No lineage nodes loaded.</p>;
  }

  return (
    <ul className="deckgo-shell-list">
      {props.nodes.map((entry) => (
        <li key={entry.node.runId}>
          <div className="deckgo-selectable-card">
            <strong>{entry.node.agentName || entry.node.agentId}</strong>
            <div className="deckgo-meta">
              run: {entry.node.runId} | depth: {entry.node.depth} | status: {entry.node.status}
            </div>
            {entry.node.task ? <div className="deckgo-meta">{entry.node.task}</div> : null}
          </div>
          {entry.children.length > 0 ? (
            <div style={{ marginLeft: 16 }}>
              <LineageTreeView nodes={entry.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function RestoredSubagentsPanel() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [runs, setRuns] = useState<DeckGoSubagentRun[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [lineage, setLineage] = useState<DeckGoSubagentsLineageResponse | null>(null);
  const [steerInstruction, setSteerInstruction] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "lineage" | "killing" | "steering">(
    "idle",
  );
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const refresh = async (preferredRunId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchSubagentRuns(filters);
      const nextRuns = next.runs ?? [];
      setRuns(nextRuns);
      setTotal(next.total ?? nextRuns.length);
      setLoadState("ready");
      setError("");
      const fallbackId = preferredRunId?.trim() || nextRuns[0]?.runId || "";
      const nextSelectedRunId = nextRuns.some((run) => run.runId === selectedRunId)
        ? selectedRunId
        : nextRuns.some((run) => run.runId === fallbackId)
          ? fallbackId
          : nextRuns[0]?.runId || "";
      setSelectedRunId(nextSelectedRunId);
      if (nextSelectedRunId) {
        const lineageResult = await fetchSubagentLineage({ runId: nextSelectedRunId });
        setLineage(lineageResult);
      } else {
        setLineage(null);
      }
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load subagents");
    }
  };

  useEffect(() => {
    void refresh();
  }, [filters.status]);

  const selectedRun = runs.find((run) => run.runId === selectedRunId) ?? runs[0] ?? null;
  const activeCount = useMemo(() => runs.filter((run) => run.status === "active").length, [runs]);
  const historyCount = runs.length - activeCount;
  const lineageTree = useMemo(() => buildLineageTree(lineage?.nodes ?? []), [lineage]);

  const selectRun = async (run: DeckGoSubagentRun) => {
    setSelectedRunId(run.runId);
    setActionState("lineage");
    try {
      const result = await fetchSubagentLineage({ runId: run.runId });
      setLineage(result);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "failed to load lineage");
    } finally {
      setActionState("idle");
    }
  };

  const killAction = async () => {
    if (!selectedRun) {
      return;
    }
    setActionState("killing");
    try {
      const result = await killSubagentRun(selectedRun.runId);
      setActionResult(result);
      setError("");
      await refresh(selectedRun.runId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "subagent kill failed");
    } finally {
      setActionState("idle");
    }
  };

  const steerAction = async () => {
    if (!selectedRun || !steerInstruction.trim()) {
      return;
    }
    setActionState("steering");
    try {
      const result = await steerSubagentRun(selectedRun.runId, steerInstruction.trim());
      setActionResult(result);
      setError("");
      setSteerInstruction("");
      await refresh(selectedRun.runId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "subagent steer failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Subagents</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned subagent run surface for active/history inspection plus lineage, kill, and
            steer actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Subagents {loadState}
              </span>
              <span className="deckgo-pill">{total} total</span>
              <span className="deckgo-pill">{filters.status} mode</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="runs" value={runs.length} />
              <ShellStat label="active" value={activeCount} />
              <ShellStat label="history" value={historyCount} />
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Run filters</p>
              <div className="deckgo-grid deckgo-grid-2">
                <input
                  className="deckgo-input"
                  value={filters.requesterAgentId}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      requesterAgentId: event.target.value,
                    }))
                  }
                  placeholder="requester agent id"
                />
                <select
                  className="deckgo-input"
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value as RunsFilter["status"],
                    }))
                  }
                >
                  <option value="active">active</option>
                  <option value="all">all</option>
                </select>
              </div>
              <div className="deckgo-actions" style={{ marginTop: 12 }}>
                <button className="deckgo-button" type="button" onClick={() => void refresh()}>
                  Refresh runs
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {runs.length === 0 ? (
              <p className="deckgo-note">No subagent runs loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {runs.map((run) => (
                  <li key={run.runId}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedRun?.runId === run.runId ? "is-selected" : ""}`}
                      onClick={() => void selectRun(run)}
                    >
                      <strong>{run.childAgentName || run.childAgentId}</strong>
                      <div className="deckgo-meta">
                        status: {run.status} | depth: {run.depth} | mode: {run.spawnMode}
                      </div>
                      <div className="deckgo-meta">
                        requester: {run.requesterAgentName || run.requesterAgentId}
                      </div>
                      {run.task ? <div className="deckgo-meta">{run.task}</div> : null}
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
            <h2 className="deckgo-card-title">Run detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice keeps the migration operational: select a run, inspect lineage, and perform
            bounded kill or steer actions without dragging in the old multi-tab shell.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedRun ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Selected run</p>
                    <strong>{selectedRun.childAgentName || selectedRun.childAgentId}</strong>
                    <p className="deckgo-note">{selectedRun.runId}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">{selectedRun.status}</span>
                    <span className="deckgo-pill">depth {selectedRun.depth}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="created" value={formatTimestamp(selectedRun.createdAt)} />
                  <ShellStat label="duration" value={selectedRun.durationMs ?? "n/a"} />
                </div>
                <div className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Steer selected run</p>
                  <div className="deckgo-grid">
                    <input
                      className="deckgo-input"
                      value={steerInstruction}
                      onChange={(event) => setSteerInstruction(event.target.value)}
                      placeholder="instruction"
                    />
                  </div>
                  <div className="deckgo-actions" style={{ marginTop: 12 }}>
                    <button
                      className="deckgo-button is-primary"
                      type="button"
                      onClick={() => void steerAction()}
                      disabled={actionState !== "idle" || !steerInstruction.trim()}
                    >
                      {actionState === "steering" ? "Steering" : "Steer"}
                    </button>
                    <button
                      className="deckgo-button is-danger"
                      type="button"
                      onClick={() => void killAction()}
                      disabled={actionState !== "idle" || selectedRun.status !== "active"}
                    >
                      {actionState === "killing" ? "Killing" : "Kill run"}
                    </button>
                  </div>
                </div>
                <JsonDetails title="Run payload" payload={selectedRun} />
              </>
            ) : (
              <p className="deckgo-note">Choose a subagent run to inspect it.</p>
            )}

            {lineage ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Lineage root</p>
                    <strong>{lineage.root.agentName || lineage.root.agentId}</strong>
                    <p className="deckgo-note">{lineage.root.sessionKey}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">{lineage.nodes.length} nodes</span>
                    <span className="deckgo-pill">lineage</span>
                  </div>
                </div>
                <LineageTreeView nodes={lineageTree} />
                <JsonDetails title="Lineage payload" payload={lineage} />
              </>
            ) : (
              <p className="deckgo-note">Select a run to load its lineage.</p>
            )}

            {actionResult ? (
              <JsonDetails title="Last subagent action" payload={actionResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
