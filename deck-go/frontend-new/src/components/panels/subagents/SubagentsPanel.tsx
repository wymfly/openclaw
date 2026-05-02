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
import { useTranslations } from "../../../i18n/provider";
import { formatDuration } from "../../../lib/format-utils";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";

type SubagentsTab = "active" | "history" | "config";
type SubagentStatusFilter = "active" | "completed" | "failed" | "timeout" | "all";
type TimeRangeFilter = "1h" | "6h" | "24h" | "all";
type SubagentsTranslator = ReturnType<typeof useTranslations>;

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
const STATUS_LABEL_KEYS: Record<SubagentStatusFilter, string> = {
  active: "statusActive",
  all: "allStatus",
  completed: "completed",
  failed: "failed",
  timeout: "timeout",
};
const TIME_RANGE_LABEL_KEYS: Record<TimeRangeFilter, string> = {
  "1h": "timeRange.1h",
  "6h": "timeRange.6h",
  "24h": "timeRange.24h",
  all: "timeRange.all",
};

function statusLabel(t: SubagentsTranslator, status?: string) {
  const key = STATUS_LABEL_KEYS[status as SubagentStatusFilter];
  return key ? t(key) : status || t("notAvailable");
}

function timeRangeLabel(t: SubagentsTranslator, range: TimeRangeFilter) {
  return t(TIME_RANGE_LABEL_KEYS[range]);
}

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

function formatTimestamp(value: number | undefined, emptyLabel: string) {
  if (!value) {
    return emptyLabel;
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

function formatRunDuration(run: DeckGoSubagentRun, labels: { elapsed: string; empty: string }) {
  if (typeof run.durationMs === "number") {
    return formatDuration(run.durationMs);
  }
  if (typeof run.startedAt === "number" && run.status === "active") {
    return `${formatDuration(Date.now() - run.startedAt)} ${labels.elapsed}`;
  }
  return labels.empty;
}

function RunDetailField(props: { emptyLabel: string; label: string; value?: string | number }) {
  return (
    <div className="deck-ui-subagents-field">
      <p className="deckgo-surface-label">{props.label}</p>
      <p className="deckgo-meta">{props.value || props.emptyLabel}</p>
    </div>
  );
}

function describeAllowedSubagents(
  config: DeckGoAgentSubagentConfigResponse | undefined,
  labels: { any: string; loading: string; none: string },
) {
  if (!config) {
    return labels.loading;
  }
  if (config.allowAny || config.allowAgents.includes("*")) {
    return labels.any;
  }
  if (config.allowAgents.length === 0) {
    return labels.none;
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

function LineageTreeView(props: {
  labels: {
    depth: string;
    empty: string;
    run: string;
    status: string;
    statusValue: (status?: string) => string;
  };
  nodes: LineageTreeNode[];
}) {
  if (props.nodes.length === 0) {
    return <p className="deckgo-note deck-ui-subagents-empty">{props.labels.empty}</p>;
  }

  return (
    <ul className="deckgo-shell-list deck-ui-subagents-list deck-ui-subagents-lineage-list">
      {props.nodes.map((entry) => (
        <li key={entry.node.runId}>
          <div className="deckgo-selectable-card deck-ui-subagents-row">
            <strong>{entry.node.agentName || entry.node.agentId}</strong>
            <div className="deckgo-meta">
              {props.labels.run}: {entry.node.runId} | {props.labels.depth}: {entry.node.depth} |{" "}
              {props.labels.status}: {props.labels.statusValue(entry.node.status)}
            </div>
            {entry.node.task ? <div className="deckgo-meta">{entry.node.task}</div> : null}
          </div>
          {entry.children.length > 0 ? (
            <div className="deck-ui-subagents-lineage-children">
              <LineageTreeView labels={props.labels} nodes={entry.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function SubagentsPanel() {
  const t = useTranslations("subagents");
  const tc = useTranslations("common");
  const ui = useDeckUI();
  const [activeTab, setActiveTab] = useState<SubagentsTab>("active");
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
        setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
      }
    },
    [filters, t],
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
      setError(loadError instanceof Error ? loadError.message : t("lineageLoadFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const killAction = async () => {
    if (!selectedRun) {
      return;
    }
    if (!window.confirm(t("killConfirm", { runId: selectedRun.runId }))) {
      return;
    }
    setActionState("killing");
    try {
      const result = await killSubagentRun(selectedRun.runId);
      setActionResult(result);
      setError("");
      await refresh(selectedRun.runId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("killFailed"));
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
      setError(actionError instanceof Error ? actionError.message : t("steerError"));
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
      setError(actionError instanceof Error ? actionError.message : t("defaultsUpdateFailed"));
    } finally {
      setConfigActionState("idle");
    }
  };

  const emptyLabel = t("notAvailable");
  const defaultLabel = tc("inherit");
  const durationLabels = { elapsed: t("elapsed"), empty: emptyLabel };
  const allowedLabels = {
    any: t("allowAny"),
    loading: tc("loading"),
    none: t("allowNone"),
  };
  const lineageLabels = {
    depth: t("depth"),
    empty: t("lineageEmpty"),
    run: t("run"),
    status: t("status"),
    statusValue: (status?: string) => statusLabel(t, status),
  };

  const selectTab = (nextTab: SubagentsTab) => {
    setActiveTab(nextTab);
    if (nextTab === "active") {
      setFilters((current) => ({ ...current, status: "active" }));
      return;
    }
    if (nextTab === "history") {
      setFilters((current) => ({
        ...current,
        status: current.status === "active" ? "all" : current.status,
      }));
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-subagents">
      <div className="deckgo-column deck-ui-subagents-column">
        <article className="deckgo-card is-float deck-ui-subagents-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("title")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("description")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-subagents-body">
            <div className="deck-ui-control-tabs" role="tablist" aria-label={t("title")}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "active"}
                className={activeTab === "active" ? "is-selected" : ""}
                onClick={() => selectTab("active")}
              >
                {t("activeRuns")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "history"}
                className={activeTab === "history" ? "is-selected" : ""}
                onClick={() => selectTab("history")}
              >
                {t("history")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "config"}
                className={activeTab === "config" ? "is-selected" : ""}
                onClick={() => selectTab("config")}
              >
                {t("config")}
              </button>
            </div>
            <div className="deckgo-pill-row deck-ui-subagents-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </span>
              <span className="deckgo-pill">{t("visibleCount", { count: runs.length })}</span>
              <span className="deckgo-pill">{t("serverTotal", { count: total })}</span>
              <span className="deckgo-pill">
                {t("mode", { mode: statusLabel(t, filters.status) })}
              </span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-subagents-stats">
              <ShellStat label={t("runsStat")} value={runs.length} />
              <ShellStat label={t("activeStat")} value={activeCount} />
              <ShellStat label={t("historyStat")} value={historyCount} />
            </div>
            {activeTab !== "config" ? (
              <div className="deckgo-surface-tile deck-ui-subagents-surface">
                <p className="deckgo-surface-label">{t("runFilters")}</p>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-subagents-form-grid">
                  <select
                    aria-label={t("childAgentFilter")}
                    className="deckgo-input deck-ui-subagents-input"
                    value={filters.childAgentId}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        childAgentId: event.target.value,
                      }))
                    }
                  >
                    <option value="">{t("allChildAgents")}</option>
                    {agentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.label}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={t("requesterAgentFilter")}
                    className="deckgo-input deck-ui-subagents-input"
                    value={filters.requesterAgentId}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        requesterAgentId: event.target.value,
                      }))
                    }
                    placeholder={t("requesterAgentPlaceholder")}
                  />
                  <select
                    aria-label={t("runStatusFilter")}
                    className="deckgo-input deck-ui-subagents-input"
                    value={filters.status}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        status: event.target.value as SubagentStatusFilter,
                      }))
                    }
                  >
                    {(["all", "active", "completed", "failed", "timeout"] as const).map(
                      (status) => (
                        <option key={status} value={status}>
                          {statusLabel(t, status)}
                        </option>
                      ),
                    )}
                  </select>
                  <select
                    aria-label={t("runTimeRangeFilter")}
                    className="deckgo-input deck-ui-subagents-input"
                    value={filters.timeRange}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        timeRange: event.target.value as TimeRangeFilter,
                      }))
                    }
                  >
                    {(["1h", "6h", "24h", "all"] as const).map((range) => (
                      <option key={range} value={range}>
                        {timeRangeLabel(t, range)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                  <button
                    className="deckgo-button deck-ui-subagents-button"
                    type="button"
                    onClick={() => void refresh()}
                  >
                    {t("refreshRuns")}
                  </button>
                  <label className="deckgo-checkbox-label deck-ui-subagents-check">
                    <input
                      checked={autoRefresh}
                      onChange={(event) => setAutoRefresh(event.target.checked)}
                      type="checkbox"
                    />
                    <span>{t("autoRefresh")}</span>
                  </label>
                </div>
              </div>
            ) : null}
            {activeTab === "config" ? (
              <>
                <div className="deckgo-surface-tile deck-ui-subagents-surface">
                  <p className="deckgo-surface-label">{t("globalDefaults")}</p>
                  <p className="deckgo-note">{t("globalDefaultsDescription")}</p>
                  <div className="deckgo-grid deckgo-grid-3 deck-ui-subagents-form-grid deck-ui-subagents-defaults-grid">
                    <label className="deckgo-label deck-ui-subagents-label">
                      <span>{t("maxSpawnDepth")}</span>
                      <input
                        aria-label={t("globalMaxSpawnDepth")}
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
                      <span>{t("maxChildrenPerAgent")}</span>
                      <input
                        aria-label={t("globalMaxChildrenPerAgent")}
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
                      <span>{t("maxConcurrent")}</span>
                      <input
                        aria-label={t("globalMaxConcurrent")}
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
                      <span>{t("archiveAfterMinutes")}</span>
                      <input
                        aria-label={t("globalArchiveAfterMinutes")}
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
                      <span>{t("runTimeoutSeconds")}</span>
                      <input
                        aria-label={t("globalRunTimeoutSeconds")}
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
                      <span>{t("thinkingDefault")}</span>
                      <input
                        aria-label={t("globalThinkingDefault")}
                        className="deckgo-input deck-ui-subagents-input"
                        value={globalDefaults.thinking}
                        onChange={(event) => updateGlobalDefault("thinking", event.target.value)}
                        placeholder={t("thinkingPlaceholder")}
                      />
                    </label>
                  </div>
                  <div className="deckgo-grid deckgo-grid-2 deck-ui-subagents-form-grid deck-ui-subagents-actions-offset">
                    <label className="deckgo-label deck-ui-subagents-label">
                      <span>{t("defaultModel")}</span>
                      <input
                        aria-label={t("globalDefaultModel")}
                        className="deckgo-input deck-ui-subagents-input"
                        value={globalDefaults.model}
                        onChange={(event) => updateGlobalDefault("model", event.target.value)}
                        placeholder={t("modelPlaceholder")}
                      />
                    </label>
                    <label className="deckgo-checkbox-label deck-ui-subagents-check">
                      <input
                        aria-label={t("globalRequireExplicitAgentId")}
                        checked={globalDefaults.requireAgentId}
                        onChange={(event) =>
                          updateGlobalDefault("requireAgentId", event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>{t("requireExplicitAgentId")}</span>
                    </label>
                  </div>
                  <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                    <button
                      className="deckgo-button deck-ui-subagents-button"
                      disabled={configActionState !== "idle"}
                      onClick={() => void loadGlobalDefaults()}
                      type="button"
                    >
                      {t("reloadDefaults")}
                    </button>
                    <button
                      className="deckgo-button deck-ui-subagents-button is-primary"
                      disabled={configActionState !== "idle"}
                      onClick={() => void saveGlobalDefaults()}
                      type="button"
                    >
                      {configActionState === "saving" ? t("savingDefaults") : t("saveDefaults")}
                    </button>
                    <span className="deckgo-pill">
                      {t("hashLabel", { hash: configBaseHash || emptyLabel })}
                    </span>
                  </div>
                  {configActionResult ? (
                    <JsonDetails title={t("defaultsSaveResult")} payload={configActionResult} />
                  ) : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-subagents-surface">
                  <p className="deckgo-surface-label">{t("perAgentPermissions")}</p>
                  {agents.length === 0 ? (
                    <p className="deckgo-note deck-ui-subagents-empty">{t("noAgentsConfigured")}</p>
                  ) : (
                    <ul className="deckgo-shell-list deck-ui-subagents-list">
                      {agents.map((agent) => {
                        const config = agentConfigs[agent.id];
                        return (
                          <li key={agent.id}>
                            <div className="deckgo-selectable-card deck-ui-subagents-row">
                              <strong>{agent.name || agent.id}</strong>
                              <div className="deckgo-meta">
                                {t("allowed")}: {describeAllowedSubagents(config, allowedLabels)}
                              </div>
                              <div className="deckgo-meta">
                                {t("depth")}: {config?.effectiveMaxSpawnDepth ?? emptyLabel} |{" "}
                                {t("children")}:{" "}
                                {config?.effectiveMaxChildrenPerAgent ?? emptyLabel} | {t("model")}:{" "}
                                {config?.model || defaultLabel}
                              </div>
                              <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                                <button
                                  className="deckgo-button deck-ui-subagents-button"
                                  type="button"
                                  onClick={() => navigateToAgent(ui, agent.id, "subagents")}
                                >
                                  {t("openAgentSubagents")}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : null}
            {error ? <p className="deckgo-note deck-ui-subagents-error">{error}</p> : null}
            {activeTab !== "config" ? (
              runs.length === 0 ? (
                <p className="deckgo-note deck-ui-subagents-empty">{t("noRunsFound")}</p>
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
                          {t("status")}: {statusLabel(t, run.status)} | {t("depth")}: {run.depth} |{" "}
                          {t("modeLabel")}: {run.spawnMode}
                        </div>
                        <div className="deckgo-meta">
                          {t("requester")}: {run.requesterAgentName || run.requesterAgentId}
                        </div>
                        {run.task ? <div className="deckgo-meta">{run.task}</div> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
            {activeTab !== "config" && visibleLimit < runs.length ? (
              <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                <button
                  className="deckgo-button deck-ui-subagents-button"
                  type="button"
                  onClick={() => setVisibleLimit((current) => current + VISIBLE_RUN_INCREMENT)}
                >
                  {t("remaining", { count: runs.length - visibleLimit })}
                </button>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-subagents-column">
        <article className="deckgo-card is-float deck-ui-subagents-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("runDetail")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("runDetailDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-subagents-body">
            {selectedRun ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-subagents-hero">
                  <div>
                    <p className="deckgo-kicker">{t("selectedRun")}</p>
                    <strong>{selectedRun.childAgentName || selectedRun.childAgentId}</strong>
                    <p className="deckgo-note">{selectedRun.runId}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-subagents-status-row">
                    <span className="deckgo-pill">{statusLabel(t, selectedRun.status)}</span>
                    <span className="deckgo-pill">
                      {t("depth")} {selectedRun.depth}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-subagents-detail-stats">
                  <ShellStat
                    label={t("created")}
                    value={formatTimestamp(selectedRun.createdAt, emptyLabel)}
                  />
                  <ShellStat
                    label={t("duration")}
                    value={formatRunDuration(selectedRun, durationLabels)}
                  />
                </div>
                <div className="deckgo-surface-tile deck-ui-subagents-surface">
                  <p className="deckgo-surface-label">{t("historicalRunDetail")}</p>
                  {selectedRun.task ? (
                    <div className="deck-ui-subagents-task-block">
                      <p className="deckgo-surface-label">{t("task")}</p>
                      <p className="deckgo-note">{selectedRun.task}</p>
                    </div>
                  ) : null}
                  <div className="deckgo-grid deckgo-grid-3 deck-ui-subagents-detail-stats">
                    <RunDetailField
                      emptyLabel={emptyLabel}
                      label={t("childAgent")}
                      value={selectedRun.childAgentName || selectedRun.childAgentId}
                    />
                    <RunDetailField
                      emptyLabel={emptyLabel}
                      label={t("requester")}
                      value={selectedRun.requesterAgentName || selectedRun.requesterAgentId}
                    />
                    <RunDetailField
                      emptyLabel={emptyLabel}
                      label={t("status")}
                      value={statusLabel(t, selectedRun.status)}
                    />
                    <RunDetailField
                      emptyLabel={emptyLabel}
                      label={t("model")}
                      value={selectedRun.model || defaultLabel}
                    />
                    <RunDetailField
                      emptyLabel={emptyLabel}
                      label={t("spawnMode")}
                      value={selectedRun.spawnMode}
                    />
                    <RunDetailField
                      emptyLabel={emptyLabel}
                      label={t("depth")}
                      value={selectedRun.depth}
                    />
                    <RunDetailField
                      emptyLabel={emptyLabel}
                      label={t("childSession")}
                      value={selectedRun.childSessionKey}
                    />
                    <RunDetailField
                      emptyLabel={emptyLabel}
                      label={t("requesterSession")}
                      value={selectedRun.requesterSessionKey}
                    />
                    <RunDetailField
                      emptyLabel={emptyLabel}
                      label={t("started")}
                      value={formatTimestamp(selectedRun.startedAt, emptyLabel)}
                    />
                    <RunDetailField
                      emptyLabel={emptyLabel}
                      label={t("ended")}
                      value={formatTimestamp(selectedRun.endedAt, emptyLabel)}
                    />
                  </div>
                  <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                    <button
                      className="deckgo-button deck-ui-subagents-button"
                      type="button"
                      disabled={!selectedRun.childAgentId}
                      onClick={() => navigateToAgent(ui, selectedRun.childAgentId, "subagents")}
                    >
                      {t("openChildAgent")}
                    </button>
                    <button
                      className="deckgo-button deck-ui-subagents-button"
                      type="button"
                      disabled={!selectedRun.requesterAgentId}
                      onClick={() => navigateToAgent(ui, selectedRun.requesterAgentId, "subagents")}
                    >
                      {t("openRequesterAgent")}
                    </button>
                    <button
                      className="deckgo-button deck-ui-subagents-button"
                      type="button"
                      disabled={!selectedRun.childSessionKey}
                      onClick={() => navigateToSession(ui, selectedRun.childSessionKey ?? "")}
                    >
                      {t("openChildSession")}
                    </button>
                    <button
                      className="deckgo-button deck-ui-subagents-button"
                      type="button"
                      disabled={!selectedRun.requesterSessionKey}
                      onClick={() => navigateToSession(ui, selectedRun.requesterSessionKey ?? "")}
                    >
                      {t("openRequesterSession")}
                    </button>
                  </div>
                  {selectedRun.status === "failed" || selectedRun.status === "timeout" ? (
                    <p className="deckgo-note deck-ui-subagents-actions-offset">
                      {t("runEndedStatus", { status: statusLabel(t, selectedRun.status) })}
                    </p>
                  ) : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-subagents-surface">
                  <p className="deckgo-surface-label">{t("steerTitle")}</p>
                  <div className="deckgo-grid deck-ui-subagents-form-grid">
                    <input
                      aria-label={t("steerInstruction")}
                      className="deckgo-input deck-ui-subagents-input"
                      value={steerInstruction}
                      onChange={(event) => setSteerInstruction(event.target.value)}
                      placeholder={t("steerPlaceholder")}
                    />
                  </div>
                  <div className="deckgo-actions deck-ui-subagents-actions deck-ui-subagents-actions-offset">
                    <button
                      className="deckgo-button deck-ui-subagents-button is-primary"
                      type="button"
                      onClick={() => void steerAction()}
                      disabled={actionState !== "idle" || !steerInstruction.trim()}
                    >
                      {actionState === "steering" ? t("steering") : t("steerConfirm")}
                    </button>
                    <button
                      className="deckgo-button deck-ui-subagents-button is-danger"
                      type="button"
                      onClick={() => void killAction()}
                      disabled={actionState !== "idle" || selectedRun.status !== "active"}
                    >
                      {actionState === "killing" ? t("killing") : t("killRun")}
                    </button>
                  </div>
                </div>
                <JsonDetails title={t("runPayload")} payload={selectedRun} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-subagents-empty">{t("chooseRun")}</p>
            )}

            {lineage ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-subagents-hero">
                  <div>
                    <p className="deckgo-kicker">{t("lineageRoot")}</p>
                    <strong>{lineage.root.agentName || lineage.root.agentId}</strong>
                    <p className="deckgo-note">{lineage.root.sessionKey}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-subagents-status-row">
                    <span className="deckgo-pill">
                      {t("nodesCount", { count: lineage.nodes.length })}
                    </span>
                    <span className="deckgo-pill">{t("lineage")}</span>
                  </div>
                </div>
                <LineageTreeView labels={lineageLabels} nodes={lineageTree} />
                <JsonDetails title={t("lineagePayload")} payload={lineage} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-subagents-empty">{t("selectRunForLineage")}</p>
            )}

            {actionResult ? <JsonDetails title={t("lastAction")} payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
