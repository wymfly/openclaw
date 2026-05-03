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
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  SegmentedControl,
  Spinner,
  Textarea,
  Toggle,
} from "../../../design-system/atoms";
import { useTranslations } from "../../../i18n/provider";
import { formatDuration } from "../../../lib/format-utils";
import { JsonDetails } from "../../shared/ShellComponents";
import "./subagents-panel.css";

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

function badgeVariant(status?: string) {
  if (status === "active") {
    return "running";
  }
  if (status === "completed") {
    return "ok";
  }
  if (status === "failed") {
    return "err";
  }
  if (status === "timeout") {
    return "warn";
  }
  return "neutral";
}

function loadVariant(loadState: PanelState) {
  if (loadState === "ready") {
    return "ok";
  }
  if (loadState === "loading") {
    return "running";
  }
  return "neutral";
}

function Field(props: { emptyLabel: string; label: string; value?: string | number }) {
  return (
    <div className="subagents-field">
      <span>{props.label}</span>
      <strong>{props.value || props.emptyLabel}</strong>
    </div>
  );
}

function MetricTile(props: { hint?: string; label: string; value: string | number }) {
  return (
    <article className="subagents-metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.hint ? <small>{props.hint}</small> : null}
    </article>
  );
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
    return <p className="subagents-panel__empty">{props.labels.empty}</p>;
  }

  return (
    <ul className="subagents-lineage-list">
      {props.nodes.map((entry) => (
        <li key={entry.node.runId}>
          <article className="subagents-lineage-node">
            <div className="subagents-row__top">
              <strong>{entry.node.agentName || entry.node.agentId}</strong>
              <Badge variant={badgeVariant(entry.node.status)}>
                {props.labels.statusValue(entry.node.status)}
              </Badge>
            </div>
            <p className="subagents-row__meta">
              {props.labels.run}: {entry.node.runId} | {props.labels.depth}: {entry.node.depth} |{" "}
              {props.labels.status}: {props.labels.statusValue(entry.node.status)}
            </p>
            {entry.node.task ? <p className="subagents-row__note">{entry.node.task}</p> : null}
          </article>
          {entry.children.length > 0 ? (
            <div className="subagents-lineage-children">
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
    <section className="subagents-panel" data-testid="subagents-panel">
      <div className="subagents-panel__header">
        <div>
          <p className="subagents-panel__eyebrow">operations / subagents</p>
          <h2>{t("title")}</h2>
          <p>{t("description")}</p>
        </div>
        <div className="subagents-panel__header-actions">
          <Badge variant={loadVariant(loadState)}>
            {loadState === "loading" ? tc("loading") : t(loadState)}
          </Badge>
          {loadState === "loading" ? <Spinner aria-label={tc("loading")} size="sm" /> : null}
          <div className="subagents-toggle">
            <Toggle
              aria-label={t("autoRefresh")}
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <span>{t("autoRefresh")}</span>
          </div>
          <Button size="sm" onClick={() => void refresh()}>
            {t("refreshRuns")}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="subagents-panel__banner" role="status">
          <Badge variant="err">{t("failed")}</Badge>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="subagents-panel__metrics">
        <MetricTile
          hint={t("mode", { mode: statusLabel(t, filters.status) })}
          label={t("visibleCount", { count: runs.length })}
          value={runs.length}
        />
        <MetricTile label={t("serverTotal", { count: total })} value={total} />
        <MetricTile label={t("activeStat")} value={activeCount} />
        <MetricTile label={t("historyStat")} value={historyCount} />
        <MetricTile
          hint={selectedRun?.model || defaultLabel}
          label={t("selectedRun")}
          value={selectedRun ? `${t("depth")} ${selectedRun.depth}` : emptyLabel}
        />
      </div>

      <div className="subagents-workbench">
        <Card className="subagents-card subagents-queue-card" padded={false}>
          <div className="subagents-card__header">
            <div>
              <h3>{activeTab === "config" ? t("config") : t("runs")}</h3>
              <p>{activeTab === "config" ? t("globalDefaultsDescription") : t("runFilters")}</p>
            </div>
            <SegmentedControl
              aria-label={t("title")}
              controlSize="xs"
              items={[
                { value: "active", label: t("activeRuns") },
                { value: "history", label: t("history") },
                { value: "config", label: t("config") },
              ]}
              value={activeTab}
              onChange={selectTab}
            />
          </div>
          <div className="subagents-card__body">
            {activeTab === "config" ? (
              <>
                <section className="subagents-surface">
                  <div className="subagents-section-heading">
                    <div>
                      <h3>{t("globalDefaults")}</h3>
                      <p>{t("globalDefaultsDescription")}</p>
                    </div>
                    <Badge>{t("hashLabel", { hash: configBaseHash || emptyLabel })}</Badge>
                  </div>
                  <div className="subagents-defaults-grid">
                    <label className="subagents-label">
                      <span>{t("maxSpawnDepth")}</span>
                      <Input
                        aria-label={t("globalMaxSpawnDepth")}
                        inputSize="sm"
                        min={1}
                        max={5}
                        type="number"
                        value={globalDefaults.maxSpawnDepth}
                        onChange={(event) =>
                          updateGlobalDefault("maxSpawnDepth", Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="subagents-label">
                      <span>{t("maxChildrenPerAgent")}</span>
                      <Input
                        aria-label={t("globalMaxChildrenPerAgent")}
                        inputSize="sm"
                        min={1}
                        max={20}
                        type="number"
                        value={globalDefaults.maxChildrenPerAgent}
                        onChange={(event) =>
                          updateGlobalDefault("maxChildrenPerAgent", Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="subagents-label">
                      <span>{t("maxConcurrent")}</span>
                      <Input
                        aria-label={t("globalMaxConcurrent")}
                        inputSize="sm"
                        min={1}
                        type="number"
                        value={globalDefaults.maxConcurrent}
                        onChange={(event) =>
                          updateGlobalDefault("maxConcurrent", Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="subagents-label">
                      <span>{t("archiveAfterMinutes")}</span>
                      <Input
                        aria-label={t("globalArchiveAfterMinutes")}
                        inputSize="sm"
                        min={0}
                        type="number"
                        value={globalDefaults.archiveAfterMinutes}
                        onChange={(event) =>
                          updateGlobalDefault("archiveAfterMinutes", Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="subagents-label">
                      <span>{t("runTimeoutSeconds")}</span>
                      <Input
                        aria-label={t("globalRunTimeoutSeconds")}
                        inputSize="sm"
                        min={0}
                        type="number"
                        value={globalDefaults.runTimeoutSeconds}
                        onChange={(event) =>
                          updateGlobalDefault("runTimeoutSeconds", Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="subagents-label">
                      <span>{t("thinkingDefault")}</span>
                      <Input
                        aria-label={t("globalThinkingDefault")}
                        inputSize="sm"
                        value={globalDefaults.thinking}
                        onChange={(event) => updateGlobalDefault("thinking", event.target.value)}
                        placeholder={t("thinkingPlaceholder")}
                      />
                    </label>
                  </div>
                  <div className="subagents-config-row">
                    <label className="subagents-label">
                      <span>{t("defaultModel")}</span>
                      <Input
                        aria-label={t("globalDefaultModel")}
                        inputSize="sm"
                        value={globalDefaults.model}
                        onChange={(event) => updateGlobalDefault("model", event.target.value)}
                        placeholder={t("modelPlaceholder")}
                      />
                    </label>
                    <div className="subagents-toggle subagents-toggle--field">
                      <Toggle
                        aria-label={t("globalRequireExplicitAgentId")}
                        checked={globalDefaults.requireAgentId}
                        onCheckedChange={(next) => updateGlobalDefault("requireAgentId", next)}
                      />
                      <span>{t("requireExplicitAgentId")}</span>
                    </div>
                  </div>
                  <div className="subagents-inline-actions">
                    <Button
                      disabled={configActionState !== "idle"}
                      size="sm"
                      onClick={() => void loadGlobalDefaults()}
                    >
                      {t("reloadDefaults")}
                    </Button>
                    <Button
                      disabled={configActionState !== "idle"}
                      size="sm"
                      variant="primary"
                      onClick={() => void saveGlobalDefaults()}
                    >
                      {configActionState === "saving" ? t("savingDefaults") : t("saveDefaults")}
                    </Button>
                  </div>
                  {configActionResult ? (
                    <JsonDetails title={t("defaultsSaveResult")} payload={configActionResult} />
                  ) : null}
                </section>
                <section className="subagents-surface">
                  <div className="subagents-section-heading">
                    <div>
                      <h3>{t("perAgentPermissions")}</h3>
                      <p>{t("globalDefaultsDescription")}</p>
                    </div>
                  </div>
                  {agents.length === 0 ? (
                    <p className="subagents-panel__empty">{t("noAgentsConfigured")}</p>
                  ) : (
                    <ul className="subagents-list">
                      {agents.map((agent) => {
                        const config = agentConfigs[agent.id];
                        return (
                          <li key={agent.id}>
                            <article className="subagents-permission-row">
                              <div className="subagents-row__top">
                                <strong>{agent.name || agent.id}</strong>
                                <Badge>
                                  {t("allowed")}: {describeAllowedSubagents(config, allowedLabels)}
                                </Badge>
                              </div>
                              <p className="subagents-row__meta">
                                {t("depth")}: {config?.effectiveMaxSpawnDepth ?? emptyLabel} |{" "}
                                {t("children")}:{" "}
                                {config?.effectiveMaxChildrenPerAgent ?? emptyLabel} | {t("model")}:{" "}
                                {config?.model || defaultLabel}
                              </p>
                              <Button
                                size="sm"
                                onClick={() => navigateToAgent(ui, agent.id, "subagents")}
                              >
                                {t("openAgentSubagents")}
                              </Button>
                            </article>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            ) : (
              <>
                <section className="subagents-surface">
                  <div className="subagents-filters">
                    <label className="subagents-label">
                      <span>{t("childAgentFilter")}</span>
                      <Select
                        aria-label={t("childAgentFilter")}
                        selectSize="sm"
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
                      </Select>
                    </label>
                    <label className="subagents-label">
                      <span>{t("requesterAgentFilter")}</span>
                      <Input
                        aria-label={t("requesterAgentFilter")}
                        inputSize="sm"
                        value={filters.requesterAgentId}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            requesterAgentId: event.target.value,
                          }))
                        }
                        placeholder={t("requesterAgentPlaceholder")}
                      />
                    </label>
                    <label className="subagents-label">
                      <span>{t("runStatusFilter")}</span>
                      <Select
                        aria-label={t("runStatusFilter")}
                        selectSize="sm"
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
                      </Select>
                    </label>
                    <label className="subagents-label">
                      <span>{t("runTimeRangeFilter")}</span>
                      <Select
                        aria-label={t("runTimeRangeFilter")}
                        selectSize="sm"
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
                      </Select>
                    </label>
                  </div>
                </section>

                {runs.length === 0 ? (
                  <p className="subagents-panel__empty">{t("noRunsFound")}</p>
                ) : (
                  <ul className="subagents-run-list">
                    {visibleRuns.map((run) => (
                      <li key={run.runId}>
                        <button
                          type="button"
                          aria-pressed={selectedRun?.runId === run.runId}
                          className={
                            selectedRun?.runId === run.runId
                              ? "subagents-run-row is-selected"
                              : "subagents-run-row"
                          }
                          onClick={() => void selectRun(run)}
                        >
                          <div className="subagents-row__top">
                            <strong>{run.childAgentName || run.childAgentId}</strong>
                            <Badge variant={badgeVariant(run.status)}>
                              {statusLabel(t, run.status)}
                            </Badge>
                          </div>
                          <p className="subagents-row__meta">
                            {t("status")}: {statusLabel(t, run.status)} | {t("depth")}: {run.depth}{" "}
                            | {t("modeLabel")}: {run.spawnMode}
                          </p>
                          <p className="subagents-row__meta">
                            {t("requester")}: {run.requesterAgentName || run.requesterAgentId} |{" "}
                            {t("duration")}: {formatRunDuration(run, durationLabels)}
                          </p>
                          {run.task ? <p className="subagents-row__note">{run.task}</p> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {visibleLimit < runs.length ? (
                  <div className="subagents-inline-actions">
                    <Button
                      size="sm"
                      onClick={() => setVisibleLimit((current) => current + VISIBLE_RUN_INCREMENT)}
                    >
                      {t("remaining", { count: runs.length - visibleLimit })}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </Card>

        <div className="subagents-detail">
          <Card className="subagents-card subagents-detail-card" padded={false}>
            <div className="subagents-card__header">
              <div>
                <h3>{t("runDetail")}</h3>
                <p>{t("runDetailDescription")}</p>
              </div>
              {actionState === "lineage" ? <Spinner aria-label={tc("loading")} size="sm" /> : null}
            </div>
            <div className="subagents-card__body">
              {selectedRun ? (
                <>
                  <section className="subagents-hero">
                    <div>
                      <p className="subagents-panel__eyebrow">{t("selectedRun")}</p>
                      <h3>{selectedRun.childAgentName || selectedRun.childAgentId}</h3>
                      <p>{selectedRun.runId}</p>
                    </div>
                    <div className="subagents-status-row">
                      <Badge variant={badgeVariant(selectedRun.status)}>
                        {statusLabel(t, selectedRun.status)}
                      </Badge>
                      <Badge>
                        {t("depth")} {selectedRun.depth}
                      </Badge>
                      <Badge>{selectedRun.spawnMode}</Badge>
                    </div>
                  </section>

                  <section className="subagents-surface">
                    <div className="subagents-section-heading">
                      <div>
                        <h3>{t("historicalRunDetail")}</h3>
                        {selectedRun.task ? <p>{selectedRun.task}</p> : null}
                      </div>
                      <Badge>{formatRunDuration(selectedRun, durationLabels)}</Badge>
                    </div>
                    <div className="subagents-detail-grid">
                      <Field
                        emptyLabel={emptyLabel}
                        label={t("childAgent")}
                        value={selectedRun.childAgentName || selectedRun.childAgentId}
                      />
                      <Field
                        emptyLabel={emptyLabel}
                        label={t("requester")}
                        value={selectedRun.requesterAgentName || selectedRun.requesterAgentId}
                      />
                      <Field
                        emptyLabel={emptyLabel}
                        label={t("status")}
                        value={statusLabel(t, selectedRun.status)}
                      />
                      <Field
                        emptyLabel={emptyLabel}
                        label={t("model")}
                        value={selectedRun.model || defaultLabel}
                      />
                      <Field
                        emptyLabel={emptyLabel}
                        label={t("spawnMode")}
                        value={selectedRun.spawnMode}
                      />
                      <Field emptyLabel={emptyLabel} label={t("depth")} value={selectedRun.depth} />
                      <Field
                        emptyLabel={emptyLabel}
                        label={t("childSession")}
                        value={selectedRun.childSessionKey}
                      />
                      <Field
                        emptyLabel={emptyLabel}
                        label={t("requesterSession")}
                        value={selectedRun.requesterSessionKey}
                      />
                      <Field
                        emptyLabel={emptyLabel}
                        label={t("created")}
                        value={formatTimestamp(selectedRun.createdAt, emptyLabel)}
                      />
                      <Field
                        emptyLabel={emptyLabel}
                        label={t("started")}
                        value={formatTimestamp(selectedRun.startedAt, emptyLabel)}
                      />
                      <Field
                        emptyLabel={emptyLabel}
                        label={t("ended")}
                        value={formatTimestamp(selectedRun.endedAt, emptyLabel)}
                      />
                    </div>
                    <div className="subagents-inline-actions">
                      <Button
                        disabled={!selectedRun.childAgentId}
                        size="sm"
                        onClick={() => navigateToAgent(ui, selectedRun.childAgentId, "subagents")}
                      >
                        {t("openChildAgent")}
                      </Button>
                      <Button
                        disabled={!selectedRun.requesterAgentId}
                        size="sm"
                        onClick={() =>
                          navigateToAgent(ui, selectedRun.requesterAgentId, "subagents")
                        }
                      >
                        {t("openRequesterAgent")}
                      </Button>
                      <Button
                        disabled={!selectedRun.childSessionKey}
                        size="sm"
                        onClick={() => navigateToSession(ui, selectedRun.childSessionKey ?? "")}
                      >
                        {t("openChildSession")}
                      </Button>
                      <Button
                        disabled={!selectedRun.requesterSessionKey}
                        size="sm"
                        onClick={() => navigateToSession(ui, selectedRun.requesterSessionKey ?? "")}
                      >
                        {t("openRequesterSession")}
                      </Button>
                    </div>
                    {selectedRun.status === "failed" || selectedRun.status === "timeout" ? (
                      <p className="subagents-panel__note">
                        {t("runEndedStatus", { status: statusLabel(t, selectedRun.status) })}
                      </p>
                    ) : null}
                  </section>

                  <section className="subagents-surface">
                    <div className="subagents-section-heading">
                      <div>
                        <h3>{t("steerTitle")}</h3>
                        <p>{t("steerWarning")}</p>
                      </div>
                    </div>
                    <Textarea
                      aria-label={t("steerInstruction")}
                      noResize
                      value={steerInstruction}
                      onChange={(event) => setSteerInstruction(event.target.value)}
                      placeholder={t("steerPlaceholder")}
                    />
                    <div className="subagents-inline-actions">
                      <Button
                        disabled={actionState !== "idle" || !steerInstruction.trim()}
                        size="sm"
                        variant="primary"
                        onClick={() => void steerAction()}
                      >
                        {actionState === "steering" ? t("steering") : t("steerConfirm")}
                      </Button>
                      <Button
                        disabled={actionState !== "idle" || selectedRun.status !== "active"}
                        size="sm"
                        variant="danger"
                        onClick={() => void killAction()}
                      >
                        {actionState === "killing" ? t("killing") : t("killRun")}
                      </Button>
                    </div>
                  </section>

                  <JsonDetails title={t("runPayload")} payload={selectedRun} />
                </>
              ) : (
                <p className="subagents-panel__empty">{t("chooseRun")}</p>
              )}
            </div>
          </Card>

          <Card className="subagents-card subagents-lineage-card" padded={false}>
            <div className="subagents-card__header">
              <div>
                <h3>{t("lineageRoot")}</h3>
                <p>{lineage?.root.sessionKey || t("selectRunForLineage")}</p>
              </div>
              {lineage ? <Badge>{t("nodesCount", { count: lineage.nodes.length })}</Badge> : null}
            </div>
            <div className="subagents-card__body">
              {lineage ? (
                <>
                  <section className="subagents-hero subagents-hero--compact">
                    <div>
                      <p className="subagents-panel__eyebrow">{t("lineageRoot")}</p>
                      <h3>{lineage.root.agentName || lineage.root.agentId}</h3>
                      <p>{lineage.root.sessionKey}</p>
                    </div>
                    <Badge>{t("lineage")}</Badge>
                  </section>
                  <LineageTreeView labels={lineageLabels} nodes={lineageTree} />
                  <JsonDetails title={t("lineagePayload")} payload={lineage} />
                </>
              ) : (
                <p className="subagents-panel__empty">{t("selectRunForLineage")}</p>
              )}

              {actionResult ? <JsonDetails title={t("lastAction")} payload={actionResult} /> : null}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
