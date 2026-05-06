import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  DeckGoAgentSubagentConfigResponse,
  DeckGoAgentSummary,
  DeckGoSubagentLineageNode,
  DeckGoSubagentRun,
  DeckGoSubagentsLineageResponse,
} from "../../../api";
import {
  fetchAgentsList,
  fetchAgentSubagentConfig,
  fetchDeckConfig,
  fetchSubagentLineage,
  fetchSubagentRuns,
  killSubagentRun,
  steerSubagentRun,
  updateAgentSubagentConfig,
} from "../../../api";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  SegmentedControl,
  Spinner,
  Tab,
  Tag,
  Textarea,
  Toggle,
} from "../../../design-system/atoms";
import { useTranslations } from "../../../i18n/provider";
import { formatDuration } from "../../../lib/format-utils";
import { JsonDetails } from "../../shared/ShellComponents";
import "./subagents-panel.css";

type LoadState = "idle" | "loading" | "ready";
type ListMode = "runs" | "permissions";
type StatusFilter = "all" | "active" | "completed" | "failed" | "timeout";
type SpawnFilter = "all" | "blocking" | "background";
type DetailTab = "overview" | "lineage" | "outcome" | "permissions" | "audit" | "raw";
type SubagentsTranslator = ReturnType<typeof useTranslations>;

type GlobalDefaults = {
  archiveAfterMinutes?: number;
  maxChildrenPerAgent?: number;
  maxConcurrent?: number;
  maxSpawnDepth?: number;
  model?: string;
  requireAgentId?: boolean;
  runTimeoutSeconds?: number;
  thinking?: unknown;
};

type LineageTreeNode = {
  node: DeckGoSubagentLineageNode;
  children: LineageTreeNode[];
};

type PermissionDraft = {
  agentId: string;
  allowAny: boolean;
  allowAgents: string[];
  model: string;
};

const POLL_INTERVAL_MS = 5_000;
const RUNS_FETCH_LIMIT = 100;
const STATUS_FILTERS: StatusFilter[] = ["all", "active", "completed", "failed", "timeout"];
const SPAWN_FILTERS: SpawnFilter[] = ["all", "blocking", "background"];
const DETAIL_TABS: DetailTab[] = ["overview", "lineage", "outcome", "permissions", "audit", "raw"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readGlobalDefaults(config: unknown): GlobalDefaults {
  const root = asRecord(config);
  const agents = asRecord(root.agents);
  const defaults = asRecord(agents.defaults);
  return asRecord(defaults.subagents) as GlobalDefaults;
}

function isLiveStatus(status?: string) {
  return status === "active";
}

function statusVariant(status?: string) {
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

function statusLabel(t: SubagentsTranslator, status?: string) {
  if (status === "active") {
    return t("statusActive");
  }
  if (status === "completed") {
    return t("completed");
  }
  if (status === "failed") {
    return t("failed");
  }
  if (status === "timeout") {
    return t("timeout");
  }
  if (status === "all") {
    return t("allStatus");
  }
  return status || t("notAvailable");
}

function spawnLabel(t: SubagentsTranslator, mode: string) {
  if (mode === "all") {
    return t("spawnAll");
  }
  if (mode === "blocking") {
    return t("spawnBlocking");
  }
  if (mode === "background") {
    return t("spawnBackground");
  }
  return mode || t("notAvailable");
}

function formatTimestamp(value: number | undefined, emptyLabel: string) {
  return value ? new Date(value).toLocaleString() : emptyLabel;
}

function formatRunDuration(run: DeckGoSubagentRun, t: SubagentsTranslator) {
  if (typeof run.durationMs === "number") {
    return formatDuration(run.durationMs);
  }
  if (typeof run.startedAt === "number" && isLiveStatus(run.status)) {
    return `${formatDuration(Date.now() - run.startedAt)} ${t("elapsed")}`;
  }
  return t("notAvailable");
}

function runSearchText(run: DeckGoSubagentRun) {
  return [
    run.runId,
    run.childSessionKey,
    run.childAgentId,
    run.childAgentName,
    run.requesterSessionKey,
    run.requesterAgentId,
    run.requesterAgentName,
    run.task,
    run.label,
    run.model,
    run.spawnMode,
    run.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function configSummary(
  config: DeckGoAgentSubagentConfigResponse | undefined,
  t: SubagentsTranslator,
) {
  if (!config) {
    return t("loading");
  }
  if (config.allowAny || config.allowAgents.includes("*")) {
    return t("allowAny");
  }
  if (config.allowAgents.length === 0) {
    return t("allowNone");
  }
  return config.allowAgents.join(", ");
}

function buildLineageTree(nodes: DeckGoSubagentLineageNode[]) {
  const childrenByParent = new Map<string, DeckGoSubagentLineageNode[]>();
  const roots: DeckGoSubagentLineageNode[] = [];

  for (const node of nodes) {
    const parentRunId = node.parentRunId || "";
    if (!parentRunId) {
      roots.push(node);
      continue;
    }
    const siblings = childrenByParent.get(parentRunId) ?? [];
    siblings.push(node);
    childrenByParent.set(parentRunId, siblings);
  }

  function build(parentRunId: string, ancestors: Set<string>): LineageTreeNode[] {
    return (childrenByParent.get(parentRunId) ?? [])
      .slice()
      .toSorted((left, right) => left.runId.localeCompare(right.runId))
      .filter((node) => !ancestors.has(node.runId))
      .map((node) => {
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(node.runId);
        return { node, children: build(node.runId, nextAncestors) };
      });
  }

  return roots
    .slice()
    .toSorted((left, right) => left.runId.localeCompare(right.runId))
    .map((node) => ({ node, children: build(node.runId, new Set([node.runId])) }));
}

function Field(props: { label: string; value: ReactNode }) {
  return (
    <div className="field-row">
      <span className="field-row__label">{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function Kpi(props: { label: string; value: string | number; hint?: string }) {
  return (
    <article className="kpi">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.hint ? <small>{props.hint}</small> : null}
    </article>
  );
}

function AgentGlyph(props: { id: string; name?: string }) {
  const label = (props.name || props.id || "?").slice(0, 2).toUpperCase();
  return (
    <span className="agent-glyph" aria-hidden="true">
      {label}
    </span>
  );
}

function LineageTree(props: {
  nodes: LineageTreeNode[];
  selectedRunId: string;
  onSelect: (runId: string) => void;
  t: SubagentsTranslator;
}) {
  if (props.nodes.length === 0) {
    return <div className="empty-block">{props.t("lineageEmpty")}</div>;
  }

  return (
    <ul className="tree" role="tree">
      {props.nodes.map((entry) => (
        <li key={entry.node.runId}>
          <button
            type="button"
            className={
              entry.node.runId === props.selectedRunId
                ? "tree-node tree-node--selected"
                : "tree-node"
            }
            role="treeitem"
            aria-selected={entry.node.runId === props.selectedRunId}
            onClick={() => props.onSelect(entry.node.runId)}
          >
            <span className="tree-node__main">
              <strong>{entry.node.agentName || entry.node.agentId}</strong>
              <small>{entry.node.runId}</small>
            </span>
            <Badge variant={statusVariant(entry.node.status)}>
              {statusLabel(props.t, entry.node.status)}
            </Badge>
          </button>
          {entry.children.length > 0 ? (
            <div className="tree-children">
              <LineageTree
                nodes={entry.children}
                selectedRunId={props.selectedRunId}
                t={props.t}
                onSelect={props.onSelect}
              />
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
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedRunIdRef = useRef("");

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [mode, setMode] = useState<ListMode>("runs");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [spawnFilter, setSpawnFilter] = useState<SpawnFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [agents, setAgents] = useState<DeckGoAgentSummary[]>([]);
  const [agentConfigs, setAgentConfigs] = useState<
    Record<string, DeckGoAgentSubagentConfigResponse>
  >({});
  const [globalDefaults, setGlobalDefaults] = useState<GlobalDefaults>({});
  const [runs, setRuns] = useState<DeckGoSubagentRun[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [lineage, setLineage] = useState<DeckGoSubagentsLineageResponse | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState<
    "idle" | "lineage" | "killing" | "steering" | "saving"
  >("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [steerOpen, setSteerOpen] = useState(false);
  const [steerDraft, setSteerDraft] = useState("");
  const [killOpen, setKillOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [permissionDraft, setPermissionDraft] = useState<PermissionDraft | null>(null);
  const [outcomeOpen, setOutcomeOpen] = useState(false);

  useEffect(() => {
    selectedRunIdRef.current = selectedRunId;
  }, [selectedRunId]);

  const agentOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const agent of agents) {
      byId.set(agent.id, agent.name || agent.id);
    }
    for (const run of runs) {
      byId.set(
        run.childAgentId,
        run.childAgentName || byId.get(run.childAgentId) || run.childAgentId,
      );
      byId.set(
        run.requesterAgentId,
        run.requesterAgentName || byId.get(run.requesterAgentId) || run.requesterAgentId,
      );
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).toSorted((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [agents, runs]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.runId === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );
  const liveCount = useMemo(() => runs.filter((run) => isLiveStatus(run.status)).length, [runs]);
  const failedCount = useMemo(
    () => runs.filter((run) => run.status === "failed" || run.status === "timeout").length,
    [runs],
  );
  const lineageTree = useMemo(() => buildLineageTree(lineage?.nodes ?? []), [lineage]);

  const filteredRuns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return runs
      .filter((run) => (statusFilter === "all" ? true : run.status === statusFilter))
      .filter((run) => (spawnFilter === "all" ? true : run.spawnMode.toLowerCase() === spawnFilter))
      .filter((run) => (query ? runSearchText(run).includes(query) : true))
      .toSorted((left, right) => {
        const liveDelta = Number(isLiveStatus(right.status)) - Number(isLiveStatus(left.status));
        return liveDelta !== 0 ? liveDelta : right.createdAt - left.createdAt;
      });
  }, [runs, searchQuery, spawnFilter, statusFilter]);

  const filteredAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return agentOptions.filter((agent) => {
      if (!query) {
        return true;
      }
      return `${agent.id} ${agent.name}`.toLowerCase().includes(query);
    });
  }, [agentOptions, searchQuery]);

  const loadAgentsAndConfig = useCallback(async () => {
    try {
      const [agentList, configSnapshot] = await Promise.all([fetchAgentsList(), fetchDeckConfig()]);
      const nextAgents = agentList.agents ?? [];
      setAgents(nextAgents);
      setGlobalDefaults(readGlobalDefaults(configSnapshot.config));

      const pairs = await Promise.all(
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
          pairs.filter(
            (pair): pair is readonly [string, DeckGoAgentSubagentConfigResponse] =>
              pair[1] !== null,
          ),
        ),
      );
    } catch {
      setAgents([]);
      setAgentConfigs({});
      setGlobalDefaults({});
    }
  }, []);

  const refresh = useCallback(
    async (preferredRunId?: string) => {
      setLoadState("loading");
      try {
        const next = await fetchSubagentRuns({
          limit: RUNS_FETCH_LIMIT,
          status: "all",
        });
        const nextRuns = next.runs ?? [];
        setRuns(nextRuns);
        setTotal(next.total ?? nextRuns.length);
        setLoadState("ready");
        setError("");

        const currentId = selectedRunIdRef.current;
        const fallbackId = preferredRunId || currentId || nextRuns[0]?.runId || "";
        const nextSelected = nextRuns.some((run) => run.runId === fallbackId)
          ? fallbackId
          : nextRuns[0]?.runId || "";
        selectedRunIdRef.current = nextSelected;
        setSelectedRunId(nextSelected);

        if (nextSelected) {
          const lineageResult = await fetchSubagentLineage({ runId: nextSelected });
          setLineage(lineageResult);
        } else {
          setLineage(null);
        }
      } catch (loadError) {
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
      }
    },
    [t],
  );

  useEffect(() => {
    void loadAgentsAndConfig();
  }, [loadAgentsAndConfig]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        void refresh();
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refresh]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (key === "p") {
        event.preventDefault();
        setMode("permissions");
      }
      if (key === "r") {
        event.preventDefault();
        void refresh();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [refresh]);

  const selectRun = async (runId: string) => {
    setSelectedRunId(runId);
    selectedRunIdRef.current = runId;
    setActionState("lineage");
    try {
      setLineage(await fetchSubagentLineage({ runId }));
      setDetailTab("overview");
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("lineageLoadFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const confirmKill = async () => {
    if (!selectedRun) {
      return;
    }
    setActionState("killing");
    try {
      const result = await killSubagentRun(selectedRun.runId);
      setActionResult(result);
      setKillOpen(false);
      setError("");
      await refresh(selectedRun.runId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("killFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const sendSteer = async () => {
    if (!selectedRun || !steerDraft.trim()) {
      return;
    }
    setActionState("steering");
    try {
      const result = await steerSubagentRun(selectedRun.runId, steerDraft.trim());
      setActionResult(result);
      setSteerDraft("");
      setSteerOpen(false);
      setError("");
      await refresh(selectedRun.runId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("steerError"));
    } finally {
      setActionState("idle");
    }
  };

  const openPermissionEditor = async (agentId: string) => {
    let config = agentConfigs[agentId];
    if (!config) {
      config = await fetchAgentSubagentConfig(agentId);
      setAgentConfigs((current) => ({ ...current, [agentId]: config }));
    }
    setPermissionDraft({
      agentId,
      allowAny: config.allowAny || config.allowAgents.includes("*"),
      allowAgents: config.allowAgents.filter((entry) => entry !== "*"),
      model: config.model ?? "",
    });
    setPermissionOpen(true);
  };

  const savePermissionDraft = async () => {
    if (!permissionDraft) {
      return;
    }
    const currentConfig = agentConfigs[permissionDraft.agentId];
    if (!currentConfig?.configHash) {
      setError(t("permissionMissingHash"));
      return;
    }
    setActionState("saving");
    try {
      const allowAgents = permissionDraft.allowAny ? ["*"] : permissionDraft.allowAgents;
      const result = await updateAgentSubagentConfig(permissionDraft.agentId, {
        allowAgents,
        model: permissionDraft.model.trim() || undefined,
        baseHash: currentConfig.configHash,
      });
      const refreshed = await fetchAgentSubagentConfig(permissionDraft.agentId);
      setAgentConfigs((current) => ({
        ...current,
        [permissionDraft.agentId]: {
          ...refreshed,
          configHash: refreshed.configHash || result.configHash || currentConfig.configHash,
        },
      }));
      setActionResult(result);
      setPermissionOpen(false);
      setPermissionDraft(null);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("permissionSaveFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const emptyLabel = t("notAvailable");

  return (
    <section className="subagents-panel" data-testid="subagents-panel">
      <header className="subagents-panel__topbar">
        <div>
          <p className="subagents-panel__eyebrow">operations / subagents</p>
          <h2>{t("title")}</h2>
          <p>{t("descriptionV2")}</p>
        </div>
        <div className="subagents-panel__actions">
          <Badge
            variant={loadState === "loading" ? "running" : loadState === "ready" ? "ok" : "neutral"}
          >
            {loadState === "loading" ? tc("loading") : t(loadState)}
          </Badge>
          {loadState === "loading" ? <Spinner aria-label={tc("loading")} size="sm" /> : null}
          <label className="subagents-auto">
            <Toggle
              aria-label={t("autoRefresh")}
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <span>{t("autoRefresh")}</span>
          </label>
          <Button size="sm" onClick={() => void refresh()}>
            {t("refreshRuns")}
          </Button>
        </div>
      </header>

      {error ? (
        <div className="banner banner--error" role="status">
          <Badge variant="err">{t("failed")}</Badge>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="kpi-strip">
        <Kpi
          label={t("visibleCount", { count: filteredRuns.length })}
          value={filteredRuns.length}
        />
        <Kpi label={t("serverTotal", { count: total })} value={total} />
        <Kpi label={t("activeStat")} value={liveCount} />
        <Kpi label={t("failedKpi")} value={failedCount} />
        <Kpi
          hint={selectedRun?.model || emptyLabel}
          label={t("selectedRun")}
          value={selectedRun ? `${t("depth")} ${selectedRun.depth}` : emptyLabel}
        />
      </div>

      <div className="subagents-workbench">
        <Card className="subagents-list-card" padded={false}>
          <div className="toolbar">
            <SegmentedControl
              aria-label={t("listMode")}
              controlSize="xs"
              items={[
                { value: "runs", label: t("runs") },
                { value: "permissions", label: t("perAgentPermissions") },
              ]}
              value={mode}
              onChange={(next) => setMode(next)}
            />
            <Input
              ref={searchRef}
              aria-label={t("search")}
              className="toolbar__search"
              inputSize="sm"
              value={searchQuery}
              placeholder={t(mode === "runs" ? "searchRuns" : "searchPermissions")}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {mode === "runs" ? (
              <>
                <SegmentedControl
                  aria-label={t("runStatusFilter")}
                  controlSize="xs"
                  items={STATUS_FILTERS.map((status) => ({
                    value: status,
                    label: statusLabel(t, status),
                  }))}
                  value={statusFilter}
                  onChange={(next) => setStatusFilter(next)}
                />
                <SegmentedControl
                  aria-label={t("spawnMode")}
                  controlSize="xs"
                  items={SPAWN_FILTERS.map((spawn) => ({
                    value: spawn,
                    label: spawnLabel(t, spawn),
                  }))}
                  value={spawnFilter}
                  onChange={(next) => setSpawnFilter(next)}
                />
              </>
            ) : null}
          </div>

          {mode === "permissions" ? (
            <div className="permissions-mode">
              <section className="global-defaults">
                <div>
                  <h3>{t("globalDefaults")}</h3>
                  <p>{t("globalDefaultsReadonly")}</p>
                </div>
                <div className="global-defaults__grid">
                  <Tag>
                    {t("maxSpawnDepth")}: {String(globalDefaults.maxSpawnDepth ?? emptyLabel)}
                  </Tag>
                  <Tag>
                    {t("maxChildrenPerAgent")}:{" "}
                    {String(globalDefaults.maxChildrenPerAgent ?? emptyLabel)}
                  </Tag>
                  <Tag>
                    {t("maxConcurrent")}: {String(globalDefaults.maxConcurrent ?? emptyLabel)}
                  </Tag>
                  <Tag>
                    {t("defaultModel")}: {globalDefaults.model ?? emptyLabel}
                  </Tag>
                </div>
              </section>
              {filteredAgents.length === 0 ? (
                <div className="empty-block">{t("noAgentsConfigured")}</div>
              ) : (
                <ul className="row-list">
                  {filteredAgents.map((agent) => {
                    const config = agentConfigs[agent.id];
                    return (
                      <li key={agent.id}>
                        <article className="row row--permission">
                          <AgentGlyph id={agent.id} name={agent.name} />
                          <div className="row__id-task">
                            <strong>{agent.name || agent.id}</strong>
                            <small>{agent.id}</small>
                          </div>
                          <div className="row__perm-policy">
                            <Badge>{configSummary(config, t)}</Badge>
                            <small>
                              {t("hashLabel", { hash: config?.configHash || emptyLabel })}
                            </small>
                          </div>
                          <div className="row__perm-caps">
                            <span className="cap-num">
                              {config?.effectiveMaxSpawnDepth ?? emptyLabel}
                            </span>
                            <small>{t("depth")}</small>
                            <span className="cap-num">
                              {config?.effectiveMaxChildrenPerAgent ?? emptyLabel}
                            </span>
                            <small>{t("children")}</small>
                          </div>
                          <Tag>{config?.model || t("inheritModel")}</Tag>
                          <Button size="sm" onClick={() => void openPermissionEditor(agent.id)}>
                            {t("editPermissions")}
                          </Button>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="empty-block">{t("noRunsFound")}</div>
          ) : (
            <ul className="row-list">
              {filteredRuns.map((run) => (
                <li key={run.runId}>
                  <button
                    type="button"
                    className={selectedRun?.runId === run.runId ? "row row--selected" : "row"}
                    aria-pressed={selectedRun?.runId === run.runId}
                    onClick={() => void selectRun(run.runId)}
                  >
                    <AgentGlyph id={run.childAgentId} name={run.childAgentName} />
                    <span className="row__id-task">
                      <strong>{run.childAgentName || run.childAgentId}</strong>
                      <small>{run.task || run.runId}</small>
                    </span>
                    <span className="parent-row">
                      {t("requester")}: {run.requesterAgentName || run.requesterAgentId}
                    </span>
                    <Tag>{run.model || emptyLabel}</Tag>
                    <span className={`mode-pill mode-pill--${run.spawnMode}`}>
                      {run.spawnMode || emptyLabel}
                    </span>
                    <span className="time-mono">{formatRunDuration(run, t)}</span>
                    <Badge variant={statusVariant(run.status)}>{statusLabel(t, run.status)}</Badge>
                    <span aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="detail" padded={false}>
          {selectedRun ? (
            <>
              <section
                className="hero"
                aria-live={isLiveStatus(selectedRun.status) ? "polite" : "off"}
              >
                <div className="hero__main">
                  <AgentGlyph id={selectedRun.childAgentId} name={selectedRun.childAgentName} />
                  <div>
                    <p className="subagents-panel__eyebrow">{t("selectedRun")}</p>
                    <h3>{selectedRun.childAgentName || selectedRun.childAgentId}</h3>
                    <p>{selectedRun.task || selectedRun.runId}</p>
                  </div>
                </div>
                <div className="hero__actions">
                  <Badge variant={statusVariant(selectedRun.status)}>
                    {statusLabel(t, selectedRun.status)}
                  </Badge>
                  <Button size="sm" onClick={() => setOutcomeOpen(true)}>
                    {t("raw")}
                  </Button>
                  {isLiveStatus(selectedRun.status) ? (
                    <>
                      <Button size="sm" variant="primary" onClick={() => setSteerOpen(true)}>
                        {t("steerConfirm")}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setKillOpen(true)}>
                        {t("killRun")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </section>

              <div className="tabs" role="tablist" aria-label={t("runDetail")}>
                {DETAIL_TABS.map((tab) => (
                  <Tab
                    key={tab}
                    active={detailTab === tab}
                    onClick={() => setDetailTab(tab)}
                    aria-label={t(`tab.${tab}`)}
                  >
                    {t(`tab.${tab}`)}
                  </Tab>
                ))}
              </div>

              <section className="section">
                {detailTab === "overview" ? (
                  <>
                    <div className="field-grid">
                      <Field
                        label={t("childAgent")}
                        value={selectedRun.childAgentName || selectedRun.childAgentId}
                      />
                      <Field
                        label={t("requester")}
                        value={selectedRun.requesterAgentName || selectedRun.requesterAgentId}
                      />
                      <Field label={t("status")} value={statusLabel(t, selectedRun.status)} />
                      <Field label={t("model")} value={selectedRun.model || emptyLabel} />
                      <Field label={t("spawnMode")} value={selectedRun.spawnMode || emptyLabel} />
                      <Field label={t("depth")} value={selectedRun.depth} />
                      <Field label={t("duration")} value={formatRunDuration(selectedRun, t)} />
                      <Field
                        label={t("created")}
                        value={formatTimestamp(selectedRun.createdAt, emptyLabel)}
                      />
                      <Field
                        label={t("started")}
                        value={formatTimestamp(selectedRun.startedAt, emptyLabel)}
                      />
                      <Field
                        label={t("ended")}
                        value={formatTimestamp(selectedRun.endedAt, emptyLabel)}
                      />
                    </div>
                    <div className="detail-actions">
                      <Button
                        size="sm"
                        onClick={() => navigateToAgent(ui, selectedRun.childAgentId, "subagents")}
                      >
                        {t("openChildAgent")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          navigateToAgent(ui, selectedRun.requesterAgentId, "subagents")
                        }
                      >
                        {t("openRequesterAgent")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => navigateToSession(ui, selectedRun.childSessionKey)}
                      >
                        {t("openChildSession")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => navigateToSession(ui, selectedRun.requesterSessionKey)}
                      >
                        {t("openRequesterSession")}
                      </Button>
                    </div>
                  </>
                ) : null}

                {detailTab === "lineage" ? (
                  <>
                    <div className="section__heading">
                      <div>
                        <h3>{t("lineageRoot")}</h3>
                        <p>{lineage?.root.sessionKey || t("selectRunForLineage")}</p>
                      </div>
                      {actionState === "lineage" ? (
                        <Spinner aria-label={tc("loading")} size="sm" />
                      ) : null}
                    </div>
                    <LineageTree
                      nodes={lineageTree}
                      selectedRunId={selectedRun.runId}
                      t={t}
                      onSelect={(runId) => void selectRun(runId)}
                    />
                  </>
                ) : null}

                {detailTab === "outcome" ? (
                  selectedRun.outcome ? (
                    <JsonDetails title={t("outcomePayload")} payload={selectedRun.outcome} />
                  ) : (
                    <div className="empty-block">
                      {isLiveStatus(selectedRun.status) ? t("outcomeRunning") : t("outcomeEmpty")}
                    </div>
                  )
                ) : null}

                {detailTab === "permissions" ? (
                  <div className="permission-grid permission-grid--readonly">
                    <div className="section__heading">
                      <div>
                        <h3>{selectedRun.requesterAgentName || selectedRun.requesterAgentId}</h3>
                        <p>{t("requesterPermissionDescription")}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void openPermissionEditor(selectedRun.requesterAgentId)}
                      >
                        {t("editPermissions")}
                      </Button>
                    </div>
                    <Field
                      label={t("allowed")}
                      value={configSummary(agentConfigs[selectedRun.requesterAgentId], t)}
                    />
                    <Field
                      label={t("model")}
                      value={agentConfigs[selectedRun.requesterAgentId]?.model || t("inheritModel")}
                    />
                    <Field
                      label={t("hash")}
                      value={agentConfigs[selectedRun.requesterAgentId]?.configHash || emptyLabel}
                    />
                  </div>
                ) : null}

                {detailTab === "audit" ? (
                  <div className="banner banner--info">
                    <Badge>{t("degraded")}</Badge>
                    <span>{t("auditUnsupported")}</span>
                  </div>
                ) : null}

                {detailTab === "raw" ? (
                  <JsonDetails title={t("runPayload")} payload={selectedRun} />
                ) : null}
              </section>

              {actionResult ? <JsonDetails title={t("lastAction")} payload={actionResult} /> : null}
            </>
          ) : (
            <div className="empty-block">{t("chooseRun")}</div>
          )}
        </Card>
      </div>

      <Modal
        open={killOpen}
        onClose={() => setKillOpen(false)}
        dismissOnScrimClick={false}
        size="sm"
        aria-label={t("killRun")}
      >
        <div className="subagents-modal">
          <h3>{t("killRun")}</h3>
          <p>{t("killDialogBody", { runId: selectedRun?.runId || emptyLabel })}</p>
          <div className="modal-actions">
            <Button size="sm" onClick={() => setKillOpen(false)}>
              {t("steerCancel")}
            </Button>
            <Button
              disabled={actionState === "killing"}
              size="sm"
              variant="danger"
              onClick={() => void confirmKill()}
            >
              {actionState === "killing" ? t("killing") : t("killRun")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={steerOpen}
        onClose={() => setSteerOpen(false)}
        size="md"
        aria-label={t("steerTitle")}
      >
        <div className="subagents-modal">
          <h3>{t("steerTitle")}</h3>
          <p>{t("steerWarning")}</p>
          <Textarea
            aria-label={t("steerInstruction")}
            noResize
            value={steerDraft}
            placeholder={t("steerPlaceholder")}
            onChange={(event) => setSteerDraft(event.target.value)}
          />
          <div className="modal-actions">
            <Button size="sm" onClick={() => setSteerOpen(false)}>
              {t("steerCancel")}
            </Button>
            <Button
              disabled={actionState === "steering" || !steerDraft.trim()}
              size="sm"
              variant="primary"
              onClick={() => void sendSteer()}
            >
              {actionState === "steering" ? t("steering") : t("sendHint")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={permissionOpen}
        onClose={() => setPermissionOpen(false)}
        size="lg"
        aria-label={t("editPermissions")}
      >
        <div className="subagents-modal">
          <h3>{t("editPermissions")}</h3>
          {permissionDraft ? (
            <>
              <label className="perm-row">
                <Toggle
                  aria-label={t("allowAny")}
                  checked={permissionDraft.allowAny}
                  onCheckedChange={(next) =>
                    setPermissionDraft((current) =>
                      current ? { ...current, allowAny: next } : current,
                    )
                  }
                />
                <span>{t("allowAnyDescription")}</span>
              </label>
              <div className="permission-grid">
                {agentOptions
                  .filter((agent) => agent.id !== permissionDraft.agentId)
                  .map((agent) => {
                    const checked = permissionDraft.allowAgents.includes(agent.id);
                    return (
                      <label
                        key={agent.id}
                        className={
                          permissionDraft.allowAny
                            ? "perm-row is-dimmed"
                            : checked
                              ? "perm-row is-active"
                              : "perm-row"
                        }
                      >
                        <input
                          disabled={permissionDraft.allowAny}
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setPermissionDraft((current) => {
                              if (!current) {
                                return current;
                              }
                              const allowAgents = event.target.checked
                                ? [...current.allowAgents, agent.id]
                                : current.allowAgents.filter((id) => id !== agent.id);
                              return { ...current, allowAgents };
                            })
                          }
                        />
                        <span>{agent.name || agent.id}</span>
                        <small>{agent.id}</small>
                      </label>
                    );
                  })}
              </div>
              <label className="subagents-modal__field">
                <span>{t("defaultModel")}</span>
                <Input
                  inputSize="sm"
                  value={permissionDraft.model}
                  placeholder={t("modelPlaceholder")}
                  onChange={(event) =>
                    setPermissionDraft((current) =>
                      current ? { ...current, model: event.target.value } : current,
                    )
                  }
                />
              </label>
              <div className="modal-actions">
                <Button size="sm" onClick={() => setPermissionOpen(false)}>
                  {t("steerCancel")}
                </Button>
                <Button
                  disabled={actionState === "saving"}
                  size="sm"
                  variant="primary"
                  onClick={() => void savePermissionDraft()}
                >
                  {actionState === "saving" ? t("savingPermissions") : t("savePermissions")}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={outcomeOpen}
        onClose={() => setOutcomeOpen(false)}
        size="lg"
        aria-label={t("raw")}
      >
        <div className="subagents-modal">
          <h3>{t("raw")}</h3>
          <JsonDetails title={t("runPayload")} payload={selectedRun ?? {}} />
          <div className="modal-actions">
            <Button size="sm" onClick={() => setOutcomeOpen(false)}>
              {t("close")}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
