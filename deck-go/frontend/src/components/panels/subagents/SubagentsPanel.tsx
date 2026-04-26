import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DeckGoAgentSubagentConfigResponse,
  DeckGoAgentSummary,
  DeckGoSubagentLineageNode,
  DeckGoSubagentRun,
  DeckGoSubagentsLineageResponse,
} from "../../../api";
import {
  applyDeckConfig,
  fetchAgentsList,
  fetchAgentSubagentConfig,
  fetchDeckConfig,
  fetchSubagentLineage,
  fetchSubagentRuns,
  killSubagentRun,
  steerSubagentRun,
} from "../../../api";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { formatDuration } from "../../../lib/format-utils";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";

type SubagentStatusFilter = "active" | "completed" | "failed" | "timeout" | "all";
type TimeRangeFilter = "1h" | "6h" | "24h" | "all";

type RunsFilter = {
  childAgentId: string;
  requesterAgentId: string;
  status: SubagentStatusFilter;
  timeRange: TimeRangeFilter;
};

type GlobalSubagentDefaults = {
  archiveAfterMinutes: number;
  maxChildrenPerAgent: number;
  maxConcurrent: number;
  maxSpawnDepth: number;
  model: string;
  requireAgentId: boolean;
  runTimeoutSeconds: number;
  thinking: string;
};

type LineageTreeNode = {
  node: DeckGoSubagentLineageNode;
  children: LineageTreeNode[];
};

const DEFAULT_FILTERS: RunsFilter = {
  childAgentId: "",
  requesterAgentId: "",
  status: "active",
  timeRange: "all",
};

const SUBAGENT_POLL_INTERVAL_MS = 5_000;
const RUNS_FETCH_LIMIT = 100;
const VISIBLE_RUN_INCREMENT = 20;
const DEFAULT_GLOBAL_SUBAGENT_DEFAULTS: GlobalSubagentDefaults = {
  archiveAfterMinutes: 60,
  maxChildrenPerAgent: 5,
  maxConcurrent: 3,
  maxSpawnDepth: 1,
  model: "",
  requireAgentId: false,
  runTimeoutSeconds: 0,
  thinking: "",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(record: Record<string, unknown>, key: string, fallback: number) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function booleanValue(record: Record<string, unknown>, key: string, fallback: boolean) {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

function readGlobalSubagentDefaults(config: unknown): GlobalSubagentDefaults {
  const root = asRecord(config);
  const agents = asRecord(root.agents);
  const defaults = asRecord(agents.defaults);
  const subagents = asRecord(defaults.subagents);
  return {
    archiveAfterMinutes: numberValue(
      subagents,
      "archiveAfterMinutes",
      DEFAULT_GLOBAL_SUBAGENT_DEFAULTS.archiveAfterMinutes,
    ),
    maxChildrenPerAgent: numberValue(
      subagents,
      "maxChildrenPerAgent",
      DEFAULT_GLOBAL_SUBAGENT_DEFAULTS.maxChildrenPerAgent,
    ),
    maxConcurrent: numberValue(
      subagents,
      "maxConcurrent",
      DEFAULT_GLOBAL_SUBAGENT_DEFAULTS.maxConcurrent,
    ),
    maxSpawnDepth: numberValue(
      subagents,
      "maxSpawnDepth",
      DEFAULT_GLOBAL_SUBAGENT_DEFAULTS.maxSpawnDepth,
    ),
    model: stringValue(subagents, "model"),
    requireAgentId: booleanValue(
      subagents,
      "requireAgentId",
      DEFAULT_GLOBAL_SUBAGENT_DEFAULTS.requireAgentId,
    ),
    runTimeoutSeconds: numberValue(
      subagents,
      "runTimeoutSeconds",
      DEFAULT_GLOBAL_SUBAGENT_DEFAULTS.runTimeoutSeconds,
    ),
    thinking: stringValue(subagents, "thinking"),
  };
}

function clampInteger(value: number, min: number, max?: number) {
  const next = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(Math.max(next, min), max ?? next);
}

function buildConfigWithGlobalSubagentDefaults(config: unknown, defaults: GlobalSubagentDefaults) {
  const root = { ...asRecord(config) };
  const agents = { ...asRecord(root.agents) };
  const agentDefaults = { ...asRecord(agents.defaults) };
  const subagents = {
    ...asRecord(agentDefaults.subagents),
    archiveAfterMinutes: clampInteger(defaults.archiveAfterMinutes, 0),
    maxChildrenPerAgent: clampInteger(defaults.maxChildrenPerAgent, 1, 20),
    maxConcurrent: clampInteger(defaults.maxConcurrent, 1),
    maxSpawnDepth: clampInteger(defaults.maxSpawnDepth, 1, 5),
    requireAgentId: defaults.requireAgentId,
    runTimeoutSeconds: clampInteger(defaults.runTimeoutSeconds, 0),
    ...(defaults.model.trim() ? { model: defaults.model.trim() } : { model: undefined }),
    ...(defaults.thinking.trim()
      ? { thinking: defaults.thinking.trim() }
      : { thinking: undefined }),
  };
  agentDefaults.subagents = subagents;
  agents.defaults = agentDefaults;
  root.agents = agents;
  return root;
}

function formatTimestamp(value?: number) {
  if (!value) {
    return "n/a";
  }
  return new Date(value).toLocaleString();
}

function timeRangeCutoff(range: TimeRangeFilter, now = Date.now()) {
  switch (range) {
    case "1h":
      return now - 60 * 60 * 1000;
    case "6h":
      return now - 6 * 60 * 60 * 1000;
    case "24h":
      return now - 24 * 60 * 60 * 1000;
    case "all":
      return null;
  }
  return null;
}

function isRunInTimeRange(run: DeckGoSubagentRun, range: TimeRangeFilter) {
  const cutoff = timeRangeCutoff(range);
  if (cutoff === null) {
    return true;
  }
  return (run.startedAt ?? run.createdAt) >= cutoff;
}

function formatRunDuration(run: DeckGoSubagentRun) {
  if (typeof run.durationMs === "number") {
    return formatDuration(run.durationMs);
  }
  if (typeof run.startedAt === "number" && run.status === "active") {
    return `${formatDuration(Date.now() - run.startedAt)} elapsed`;
  }
  return "n/a";
}

function RunDetailField(props: { label: string; value?: string | number }) {
  return (
    <div className="deck-ui-subagents-field">
      <p className="deckgo-surface-label">{props.label}</p>
      <p className="deckgo-meta">{props.value || "n/a"}</p>
    </div>
  );
}

function describeAllowedSubagents(config?: DeckGoAgentSubagentConfigResponse) {
  if (!config) {
    return "loading";
  }
  if (config.allowAny || config.allowAgents.includes("*")) {
    return "Any";
  }
  if (config.allowAgents.length === 0) {
    return "None";
  }
  return config.allowAgents.join(", ");
}

function buildLineageTree(nodes: DeckGoSubagentLineageNode[]) {
  const childrenByParent = new Map<string, DeckGoSubagentLineageNode[]>();
  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentRunId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentRunId, siblings);
  }

  function build(parentRunId: string, ancestors: Set<string>): LineageTreeNode[] {
    const children = (childrenByParent.get(parentRunId) ?? [])
      .slice()
      .toSorted((left, right) =>
        left.depth === right.depth
          ? left.runId.localeCompare(right.runId)
          : left.depth - right.depth,
      );
    return children
      .filter((node) => !ancestors.has(node.runId))
      .map((node) => {
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(node.runId);
        return {
          node,
          children: build(node.runId, nextAncestors),
        };
      });
  }

  const roots = nodes
    .filter((node) => !node.parentRunId)
    .slice()
    .toSorted((left, right) => left.runId.localeCompare(right.runId));
  return roots.map((node) => ({
    node,
    children: build(node.runId, new Set([node.runId])),
  }));
}

function LineageTreeView(props: { nodes: LineageTreeNode[] }) {
  if (props.nodes.length === 0) {
    return <p className="deckgo-note deck-ui-subagents-empty">No lineage nodes loaded.</p>;
  }

  return (
    <ul className="deckgo-shell-list deck-ui-subagents-list deck-ui-subagents-lineage-list">
      {props.nodes.map((entry) => (
        <li key={entry.node.runId}>
          <div className="deckgo-selectable-card deck-ui-subagents-row">
            <strong>{entry.node.agentName || entry.node.agentId}</strong>
            <div className="deckgo-meta">
              run: {entry.node.runId} | depth: {entry.node.depth} | status: {entry.node.status}
            </div>
            {entry.node.task ? <div className="deckgo-meta">{entry.node.task}</div> : null}
          </div>
          {entry.children.length > 0 ? (
            <div className="deck-ui-subagents-lineage-children">
              <LineageTreeView nodes={entry.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function SubagentsPanel() {
  const ui = useDeckUI();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [agents, setAgents] = useState<DeckGoAgentSummary[]>([]);
  const [agentConfigs, setAgentConfigs] = useState<
    Record<string, DeckGoAgentSubagentConfigResponse>
  >({});
  const [globalDefaults, setGlobalDefaults] = useState(DEFAULT_GLOBAL_SUBAGENT_DEFAULTS);
  const [configBaseHash, setConfigBaseHash] = useState("");
  const [runs, setRuns] = useState<DeckGoSubagentRun[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState("");
  const selectedRunIdRef = useRef("");
  const [lineage, setLineage] = useState<DeckGoSubagentsLineageResponse | null>(null);
  const [steerInstruction, setSteerInstruction] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [configActionState, setConfigActionState] = useState<"idle" | "saving">("idle");
  const [actionState, setActionState] = useState<"idle" | "lineage" | "killing" | "steering">(
    "idle",
  );
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_RUN_INCREMENT);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [configActionResult, setConfigActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    selectedRunIdRef.current = selectedRunId;
  }, [selectedRunId]);

  const loadAgents = useCallback(async () => {
    try {
      const next = await fetchAgentsList();
      const nextAgents = next.agents ?? [];
      setAgents(nextAgents);
      const configs = await Promise.all(
        nextAgents.map(async (agent) => {
          try {
            return [agent.id, await fetchAgentSubagentConfig(agent.id)] as const;
          } catch {
            return [agent.id, null] as const;
          }
        }),
      );
      setAgentConfigs(
        Object.fromEntries(
          configs.filter(
            (entry): entry is readonly [string, DeckGoAgentSubagentConfigResponse] =>
              entry[1] !== null,
          ),
        ),
      );
    } catch {
      setAgents([]);
      setAgentConfigs({});
    }
  }, []);

  const loadGlobalDefaults = useCallback(async () => {
    try {
      const snapshot = await fetchDeckConfig();
      setGlobalDefaults(readGlobalSubagentDefaults(snapshot.config));
      setConfigBaseHash(snapshot.baseHash ?? snapshot.hash ?? "");
    } catch {
      setGlobalDefaults(DEFAULT_GLOBAL_SUBAGENT_DEFAULTS);
      setConfigBaseHash("");
    }
  }, []);

  const refresh = useCallback(
    async (preferredRunId?: string) => {
      setLoadState("loading");
      try {
        const request: NonNullable<Parameters<typeof fetchSubagentRuns>[0]> = {
          limit: RUNS_FETCH_LIMIT,
          status: filters.status,
        };
        if (filters.childAgentId.trim()) {
          request.agentId = filters.childAgentId.trim();
        }
        if (filters.requesterAgentId.trim()) {
          request.requesterAgentId = filters.requesterAgentId.trim();
        }
        const next = await fetchSubagentRuns(request);
        const nextRuns = (next.runs ?? []).filter((run) =>
          isRunInTimeRange(run, filters.timeRange),
        );
        setRuns(nextRuns);
        setTotal(next.total ?? nextRuns.length);
        setLoadState("ready");
        setError("");
        const fallbackId = preferredRunId?.trim() || nextRuns[0]?.runId || "";
        const currentSelectedRunId = selectedRunIdRef.current;
        const nextSelectedRunId = nextRuns.some((run) => run.runId === currentSelectedRunId)
          ? currentSelectedRunId
          : nextRuns.some((run) => run.runId === fallbackId)
            ? fallbackId
            : nextRuns[0]?.runId || "";
        selectedRunIdRef.current = nextSelectedRunId;
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
    },
    [filters],
  );

  useEffect(() => {
    void loadAgents();
    void loadGlobalDefaults();
  }, [loadAgents, loadGlobalDefaults]);

  useEffect(() => {
    setVisibleLimit(VISIBLE_RUN_INCREMENT);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }
    const poll = () => {
      if (document.visibilityState !== "hidden") {
        void refresh();
      }
    };
    const timer = window.setInterval(poll, SUBAGENT_POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState !== "hidden") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [autoRefresh, refresh]);

  const selectedRun = runs.find((run) => run.runId === selectedRunId) ?? runs[0] ?? null;
  const activeCount = useMemo(() => runs.filter((run) => run.status === "active").length, [runs]);
  const historyCount = runs.length - activeCount;
  const visibleRuns = useMemo(() => runs.slice(0, visibleLimit), [runs, visibleLimit]);
  const lineageTree = useMemo(() => buildLineageTree(lineage?.nodes ?? []), [lineage]);
  const agentOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const agent of agents) {
      byId.set(agent.id, agent.name || agent.id);
    }
    for (const run of runs) {
      if (run.childAgentId) {
        byId.set(
          run.childAgentId,
          run.childAgentName || byId.get(run.childAgentId) || run.childAgentId,
        );
      }
      if (run.requesterAgentId) {
        byId.set(
          run.requesterAgentId,
          run.requesterAgentName || byId.get(run.requesterAgentId) || run.requesterAgentId,
        );
      }
    }
    return Array.from(byId, ([id, label]) => ({ id, label })).toSorted((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [agents, runs]);

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
    if (!window.confirm(`Kill subagent run ${selectedRun.runId}?`)) {
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

  const updateGlobalDefault = <Key extends keyof GlobalSubagentDefaults>(
    key: Key,
    value: GlobalSubagentDefaults[Key],
  ) => {
    setGlobalDefaults((current) => ({ ...current, [key]: value }));
  };

  const saveGlobalDefaults = async () => {
    setConfigActionState("saving");
    try {
      const snapshot = await fetchDeckConfig();
      const raw =
        typeof snapshot.raw === "string"
          ? snapshot.raw
          : JSON.stringify(snapshot.config ?? {}, null, 2);
      const parsed = JSON.parse(raw) as unknown;
      const nextConfig = buildConfigWithGlobalSubagentDefaults(parsed, globalDefaults);
      const result = await applyDeckConfig(
        JSON.stringify(nextConfig, null, 2),
        snapshot.baseHash ?? snapshot.hash ?? configBaseHash,
      );
      setConfigActionResult(result);
      setConfigBaseHash(result.baseHash ?? result.hash ?? configBaseHash);
      setError("");
      await loadGlobalDefaults();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "global subagent defaults update failed",
      );
    } finally {
      setConfigActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-subagents">
      <div className="deckgo-column deck-ui-subagents-column">
        <article className="deckgo-card is-float deck-ui-subagents-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Subagents</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Subagent runs show active/history inspection plus lineage, kill, and steer actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-subagents-body">
            <div className="deckgo-pill-row deck-ui-subagents-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Subagents {loadState}
              </span>
              <span className="deckgo-pill">{runs.length} visible</span>
              <span className="deckgo-pill">{total} server total</span>
              <span className="deckgo-pill">{filters.status} mode</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-subagents-stats">
              <ShellStat label="runs" value={runs.length} />
              <ShellStat label="active" value={activeCount} />
              <ShellStat label="history" value={historyCount} />
            </div>
            <div className="deckgo-surface-tile deck-ui-subagents-surface">
              <p className="deckgo-surface-label">Run filters</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-subagents-form-grid">
                <select
                  aria-label="Child agent filter"
                  className="deckgo-input deck-ui-subagents-input"
                  value={filters.childAgentId}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      childAgentId: event.target.value,
                    }))
                  }
                >
                  <option value="">all child agents</option>
                  {agentOptions.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label}
                    </option>
                  ))}
                </select>
                <input
                  className="deckgo-input deck-ui-subagents-input"
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
                  aria-label="Run status filter"
                  className="deckgo-input deck-ui-subagents-input"
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value as SubagentStatusFilter,
                    }))
                  }
                >
                  <option value="all">all</option>
                  <option value="active">active</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                  <option value="timeout">timeout</option>
                </select>
                <select
                  aria-label="Run time range filter"
                  className="deckgo-input deck-ui-subagents-input"
                  value={filters.timeRange}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      timeRange: event.target.value as TimeRangeFilter,
                    }))
                  }
                >
                  <option value="1h">last 1h</option>
                  <option value="6h">last 6h</option>
                  <option value="24h">last 24h</option>
                  <option value="all">all time</option>
                </select>
              </div>
              <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                <button
                  className="deckgo-button deck-ui-subagents-button"
                  type="button"
                  onClick={() => void refresh()}
                >
                  Refresh runs
                </button>
                <label className="deckgo-checkbox-label deck-ui-subagents-check">
                  <input
                    checked={autoRefresh}
                    onChange={(event) => setAutoRefresh(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Auto refresh</span>
                </label>
              </div>
            </div>
            <div className="deckgo-surface-tile deck-ui-subagents-surface">
              <p className="deckgo-surface-label">Global spawn defaults</p>
              <p className="deckgo-note">
                Reads and writes Gateway-valid agents.defaults.subagents config.
              </p>
              <div className="deckgo-grid deckgo-grid-3 deck-ui-subagents-form-grid deck-ui-subagents-defaults-grid">
                <label className="deckgo-label deck-ui-subagents-label">
                  <span>Max spawn depth</span>
                  <input
                    aria-label="Global max spawn depth"
                    className="deckgo-input deck-ui-subagents-input"
                    min={1}
                    max={5}
                    type="number"
                    value={globalDefaults.maxSpawnDepth}
                    onChange={(event) =>
                      updateGlobalDefault("maxSpawnDepth", Number(event.target.value))
                    }
                  />
                </label>
                <label className="deckgo-label deck-ui-subagents-label">
                  <span>Max children per agent</span>
                  <input
                    aria-label="Global max children per agent"
                    className="deckgo-input deck-ui-subagents-input"
                    min={1}
                    max={20}
                    type="number"
                    value={globalDefaults.maxChildrenPerAgent}
                    onChange={(event) =>
                      updateGlobalDefault("maxChildrenPerAgent", Number(event.target.value))
                    }
                  />
                </label>
                <label className="deckgo-label deck-ui-subagents-label">
                  <span>Max concurrent</span>
                  <input
                    aria-label="Global max concurrent"
                    className="deckgo-input deck-ui-subagents-input"
                    min={1}
                    type="number"
                    value={globalDefaults.maxConcurrent}
                    onChange={(event) =>
                      updateGlobalDefault("maxConcurrent", Number(event.target.value))
                    }
                  />
                </label>
                <label className="deckgo-label deck-ui-subagents-label">
                  <span>Archive after minutes</span>
                  <input
                    aria-label="Global archive after minutes"
                    className="deckgo-input deck-ui-subagents-input"
                    min={0}
                    type="number"
                    value={globalDefaults.archiveAfterMinutes}
                    onChange={(event) =>
                      updateGlobalDefault("archiveAfterMinutes", Number(event.target.value))
                    }
                  />
                </label>
                <label className="deckgo-label deck-ui-subagents-label">
                  <span>Run timeout seconds</span>
                  <input
                    aria-label="Global run timeout seconds"
                    className="deckgo-input deck-ui-subagents-input"
                    min={0}
                    type="number"
                    value={globalDefaults.runTimeoutSeconds}
                    onChange={(event) =>
                      updateGlobalDefault("runTimeoutSeconds", Number(event.target.value))
                    }
                  />
                </label>
                <label className="deckgo-label deck-ui-subagents-label">
                  <span>Thinking default</span>
                  <input
                    aria-label="Global thinking default"
                    className="deckgo-input deck-ui-subagents-input"
                    value={globalDefaults.thinking}
                    onChange={(event) => updateGlobalDefault("thinking", event.target.value)}
                    placeholder="low | medium | high"
                  />
                </label>
              </div>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-subagents-form-grid deck-ui-subagents-actions-offset">
                <label className="deckgo-label deck-ui-subagents-label">
                  <span>Default model</span>
                  <input
                    aria-label="Global default model"
                    className="deckgo-input deck-ui-subagents-input"
                    value={globalDefaults.model}
                    onChange={(event) => updateGlobalDefault("model", event.target.value)}
                    placeholder="provider/model"
                  />
                </label>
                <label className="deckgo-checkbox-label deck-ui-subagents-check">
                  <input
                    aria-label="Global require explicit agent id"
                    checked={globalDefaults.requireAgentId}
                    onChange={(event) =>
                      updateGlobalDefault("requireAgentId", event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>Require explicit agent id</span>
                </label>
              </div>
              <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                <button
                  className="deckgo-button deck-ui-subagents-button"
                  disabled={configActionState !== "idle"}
                  onClick={() => void loadGlobalDefaults()}
                  type="button"
                >
                  Reload defaults
                </button>
                <button
                  className="deckgo-button deck-ui-subagents-button is-primary"
                  disabled={configActionState !== "idle"}
                  onClick={() => void saveGlobalDefaults()}
                  type="button"
                >
                  {configActionState === "saving" ? "Saving defaults" : "Save defaults"}
                </button>
                <span className="deckgo-pill">hash {configBaseHash || "n/a"}</span>
              </div>
              {configActionResult ? (
                <JsonDetails title="Subagent defaults save result" payload={configActionResult} />
              ) : null}
            </div>
            <div className="deckgo-surface-tile deck-ui-subagents-surface">
              <p className="deckgo-surface-label">Per-agent permissions</p>
              {agents.length === 0 ? (
                <p className="deckgo-note deck-ui-subagents-empty">No agents configured.</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-subagents-list">
                  {agents.map((agent) => {
                    const config = agentConfigs[agent.id];
                    return (
                      <li key={agent.id}>
                        <div className="deckgo-selectable-card deck-ui-subagents-row">
                          <strong>{agent.name || agent.id}</strong>
                          <div className="deckgo-meta">
                            allowed: {describeAllowedSubagents(config)}
                          </div>
                          <div className="deckgo-meta">
                            depth: {config?.effectiveMaxSpawnDepth ?? "n/a"} | children:{" "}
                            {config?.effectiveMaxChildrenPerAgent ?? "n/a"} | model:{" "}
                            {config?.model || "default"}
                          </div>
                          <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                            <button
                              className="deckgo-button deck-ui-subagents-button"
                              type="button"
                              onClick={() => navigateToAgent(ui, agent.id, "subagents")}
                            >
                              Open agent subagents
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {error ? <p className="deckgo-note deck-ui-subagents-error">{error}</p> : null}
            {runs.length === 0 ? (
              <p className="deckgo-note deck-ui-subagents-empty">No subagent runs loaded.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-subagents-list">
                {visibleRuns.map((run) => (
                  <li key={run.runId}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-subagents-row ${selectedRun?.runId === run.runId ? "is-selected" : ""}`}
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
            {visibleLimit < runs.length ? (
              <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                <button
                  className="deckgo-button deck-ui-subagents-button"
                  type="button"
                  onClick={() => setVisibleLimit((current) => current + VISIBLE_RUN_INCREMENT)}
                >
                  Load more ({runs.length - visibleLimit} remaining)
                </button>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-subagents-column">
        <article className="deckgo-card is-float deck-ui-subagents-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Run detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Select a run, inspect lineage, and perform supported kill or steer actions from current
            run state.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-subagents-body">
            {selectedRun ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-subagents-hero">
                  <div>
                    <p className="deckgo-kicker">Selected run</p>
                    <strong>{selectedRun.childAgentName || selectedRun.childAgentId}</strong>
                    <p className="deckgo-note">{selectedRun.runId}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-subagents-status-row">
                    <span className="deckgo-pill">{selectedRun.status}</span>
                    <span className="deckgo-pill">depth {selectedRun.depth}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-subagents-detail-stats">
                  <ShellStat label="created" value={formatTimestamp(selectedRun.createdAt)} />
                  <ShellStat label="duration" value={formatRunDuration(selectedRun)} />
                </div>
                <div className="deckgo-surface-tile deck-ui-subagents-surface">
                  <p className="deckgo-surface-label">Historical run detail</p>
                  {selectedRun.task ? (
                    <div className="deck-ui-subagents-task-block">
                      <p className="deckgo-surface-label">task</p>
                      <p className="deckgo-note">{selectedRun.task}</p>
                    </div>
                  ) : null}
                  <div className="deckgo-grid deckgo-grid-3 deck-ui-subagents-detail-stats">
                    <RunDetailField
                      label="child agent"
                      value={selectedRun.childAgentName || selectedRun.childAgentId}
                    />
                    <RunDetailField
                      label="requester"
                      value={selectedRun.requesterAgentName || selectedRun.requesterAgentId}
                    />
                    <RunDetailField label="status" value={selectedRun.status} />
                    <RunDetailField label="model" value={selectedRun.model || "default"} />
                    <RunDetailField label="spawn mode" value={selectedRun.spawnMode} />
                    <RunDetailField label="depth" value={selectedRun.depth} />
                    <RunDetailField label="child session" value={selectedRun.childSessionKey} />
                    <RunDetailField
                      label="requester session"
                      value={selectedRun.requesterSessionKey}
                    />
                    <RunDetailField
                      label="started"
                      value={formatTimestamp(selectedRun.startedAt)}
                    />
                    <RunDetailField label="ended" value={formatTimestamp(selectedRun.endedAt)} />
                  </div>
                  <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                    <button
                      className="deckgo-button deck-ui-subagents-button"
                      type="button"
                      disabled={!selectedRun.childAgentId}
                      onClick={() => navigateToAgent(ui, selectedRun.childAgentId, "subagents")}
                    >
                      Open child agent
                    </button>
                    <button
                      className="deckgo-button deck-ui-subagents-button"
                      type="button"
                      disabled={!selectedRun.requesterAgentId}
                      onClick={() => navigateToAgent(ui, selectedRun.requesterAgentId, "subagents")}
                    >
                      Open requester agent
                    </button>
                    <button
                      className="deckgo-button deck-ui-subagents-button"
                      type="button"
                      disabled={!selectedRun.childSessionKey}
                      onClick={() => navigateToSession(ui, selectedRun.childSessionKey ?? "")}
                    >
                      Open child session
                    </button>
                    <button
                      className="deckgo-button deck-ui-subagents-button"
                      type="button"
                      disabled={!selectedRun.requesterSessionKey}
                      onClick={() => navigateToSession(ui, selectedRun.requesterSessionKey ?? "")}
                    >
                      Open requester session
                    </button>
                  </div>
                  {selectedRun.status === "failed" || selectedRun.status === "timeout" ? (
                    <p className="deckgo-note deck-ui-subagents-actions-offset">
                      Run ended with status {selectedRun.status}; inspect the raw payload for
                      Gateway-provided outcome details.
                    </p>
                  ) : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-subagents-surface">
                  <p className="deckgo-surface-label">Steer selected run</p>
                  <div className="deckgo-grid deck-ui-subagents-form-grid">
                    <input
                      className="deckgo-input deck-ui-subagents-input"
                      value={steerInstruction}
                      onChange={(event) => setSteerInstruction(event.target.value)}
                      placeholder="instruction"
                    />
                  </div>
                  <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                    <button
                      className="deckgo-button deck-ui-subagents-button is-primary"
                      type="button"
                      onClick={() => void steerAction()}
                      disabled={actionState !== "idle" || !steerInstruction.trim()}
                    >
                      {actionState === "steering" ? "Steering" : "Steer"}
                    </button>
                    <button
                      className="deckgo-button deck-ui-subagents-button is-danger"
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
              <p className="deckgo-note deck-ui-subagents-empty">
                Choose a subagent run to inspect it.
              </p>
            )}

            {lineage ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-subagents-hero">
                  <div>
                    <p className="deckgo-kicker">Lineage root</p>
                    <strong>{lineage.root.agentName || lineage.root.agentId}</strong>
                    <p className="deckgo-note">{lineage.root.sessionKey}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-subagents-status-row">
                    <span className="deckgo-pill">{lineage.nodes.length} nodes</span>
                    <span className="deckgo-pill">lineage</span>
                  </div>
                </div>
                <LineageTreeView nodes={lineageTree} />
                <JsonDetails title="Lineage payload" payload={lineage} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-subagents-empty">
                Select a run to load its lineage.
              </p>
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
