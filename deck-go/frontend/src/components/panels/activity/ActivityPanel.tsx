import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DeckGoActivityEvent,
  DeckGoMonitorRun,
  DeckGoMonitorRunDetailResponse,
  DeckGoMonitorStatsResponse,
} from "../../../api";
import {
  fetchActivityEvents,
  fetchMonitorRunDetail,
  fetchMonitorRuns,
  fetchMonitorStats,
} from "../../../api";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { formatDuration, formatTokenCount } from "../../../lib/format-utils";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { useActivitySSE } from "./useActivitySSE";

type PanelState = "idle" | "loading" | "ready";
type ActivityTimeRange = "1h" | "6h" | "24h" | "7d" | "all";
type ActivityTimeGroup = "today" | "yesterday" | "thisWeek" | "older";
type MonitorRunStatusFilter = "all" | "running" | "completed" | "error";
type MonitorRunQuery = Parameters<typeof fetchMonitorRuns>[0];

const GROUP_ORDER: ActivityTimeGroup[] = ["today", "yesterday", "thisWeek", "older"];
const GROUP_LABELS: Record<ActivityTimeGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  older: "Older",
};
const MONITOR_RUN_STATUSES: MonitorRunStatusFilter[] = ["all", "running", "completed", "error"];

type RunModelStat = {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  fallback: boolean;
};

type RunToolEvent = {
  id: number;
  name: string;
  phase: string;
  durationMs: number;
};

type RunFileEvent = {
  id: number;
  kind: string;
  path: string;
};

type RunSubagentEvent = {
  id: number;
  runId: string;
  agentId: string;
  status: string;
  task: string;
};

function withinRange(timestamp: number, range: ActivityTimeRange) {
  if (range === "all") {
    return true;
  }
  const now = Date.now();
  const age = now - timestamp;
  switch (range) {
    case "1h":
      return age <= 60 * 60 * 1_000;
    case "6h":
      return age <= 6 * 60 * 60 * 1_000;
    case "24h":
      return age <= 24 * 60 * 60 * 1_000;
    case "7d":
      return age <= 7 * 24 * 60 * 1_000;
    default:
      return true;
  }
}

function rangeToSince(range: ActivityTimeRange) {
  if (range === "all") {
    return undefined;
  }
  const now = Date.now();
  const ms =
    range === "1h"
      ? 60 * 60 * 1_000
      : range === "6h"
        ? 6 * 60 * 60 * 1_000
        : range === "24h"
          ? 24 * 60 * 60 * 1_000
          : 7 * 24 * 60 * 60 * 1_000;
  return new Date(now - ms).toISOString();
}

function getTimeGroup(timestamp: number): ActivityTimeGroup {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1_000;
  const isoDay = now.getDay() === 0 ? 7 : now.getDay();
  const weekStart = todayStart - (isoDay - 1) * 24 * 60 * 60 * 1_000;

  if (timestamp >= todayStart) {
    return "today";
  }
  if (timestamp >= yesterdayStart) {
    return "yesterday";
  }
  if (timestamp >= weekStart) {
    return "thisWeek";
  }
  return "older";
}

function parseRunEventData(data: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Plain text event rows are still useful in the raw event list.
  }
  return {};
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function classifyFileOp(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("write") || lower.includes("create")) {
    return "write";
  }
  if (lower.includes("edit") || lower.includes("modify") || lower.includes("patch")) {
    return "modify";
  }
  return "read";
}

export function ActivityPanel() {
  const ui = useDeckUI();
  const [events, setEvents] = useState<DeckGoActivityEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>("24h");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ActivityTimeGroup>>(() => new Set());
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [error, setError] = useState("");
  const [monitorRuns, setMonitorRuns] = useState<DeckGoMonitorRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runDetail, setRunDetail] = useState<DeckGoMonitorRunDetailResponse | null>(null);
  const [monitorStats, setMonitorStats] = useState<DeckGoMonitorStatsResponse | null>(null);
  const [runsState, setRunsState] = useState<PanelState>("idle");
  const [runDetailState, setRunDetailState] = useState<PanelState>("idle");
  const [statsState, setStatsState] = useState<PanelState>("idle");
  const [monitorError, setMonitorError] = useState("");
  const [monitorNextCursor, setMonitorNextCursor] = useState<string | null>(null);
  const [runAgentFilter, setRunAgentFilter] = useState("");
  const [runSessionFilter, setRunSessionFilter] = useState("");
  const [runStatusFilter, setRunStatusFilter] = useState<MonitorRunStatusFilter>("all");
  const [runTimeRange, setRunTimeRange] = useState<ActivityTimeRange>("all");

  const mergeActivityEvent = useCallback((event: DeckGoActivityEvent) => {
    setEvents((current) => {
      const withoutDuplicate = current.filter((entry) => entry.id !== event.id);
      return [event, ...withoutDuplicate]
        .toSorted((left, right) => right.timestamp - left.timestamp)
        .slice(0, 200);
    });
    setSelectedEventId((current) => current || event.id);
  }, []);

  useActivitySSE(mergeActivityEvent);

  const refresh = async (preferredEventId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchActivityEvents(100);
      const nextEvents = (next.events ?? [])
        .slice()
        .toSorted((left, right) => right.timestamp - left.timestamp);
      setEvents((current) => {
        const seen = new Set(nextEvents.map((event) => event.id));
        const liveOnly = current.filter((event) => !seen.has(event.id));
        return [...nextEvents, ...liveOnly]
          .toSorted((left, right) => right.timestamp - left.timestamp)
          .slice(0, 200);
      });
      setLoadState("ready");
      setError("");
      const fallbackId = preferredEventId?.trim() || nextEvents[0]?.id || "";
      setSelectedEventId((current) =>
        nextEvents.some((event) => event.id === current)
          ? current
          : nextEvents.some((event) => event.id === fallbackId)
            ? fallbackId
            : nextEvents[0]?.id || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load activity");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const buildRunQuery = useCallback(
    (cursor?: string): MonitorRunQuery => {
      const query: MonitorRunQuery = { limit: 50 };
      if (runAgentFilter.trim()) {
        query.agentId = runAgentFilter.trim();
      }
      if (runSessionFilter.trim()) {
        query.sessionKey = runSessionFilter.trim();
      }
      if (runStatusFilter !== "all") {
        query.status = runStatusFilter;
      }
      const since = rangeToSince(runTimeRange);
      if (since) {
        query.since = since;
      }
      if (cursor) {
        query.cursor = cursor;
      }
      return query;
    },
    [runAgentFilter, runSessionFilter, runStatusFilter, runTimeRange],
  );

  const refreshRuns = useCallback(
    async (preferredRunId?: string) => {
      setRunsState("loading");
      try {
        const next = await fetchMonitorRuns(buildRunQuery());
        const runs = next.runs ?? [];
        setMonitorRuns(runs);
        setMonitorNextCursor(next.nextCursor ?? null);
        setRunsState("ready");
        setMonitorError("");
        const fallbackRunId = preferredRunId?.trim() || runs[0]?.runId || "";
        const nextRunId = runs.some((run) => run.runId === fallbackRunId)
          ? fallbackRunId
          : runs[0]?.runId || "";
        setSelectedRunId(nextRunId);
        if (nextRunId) {
          void loadRunDetail(nextRunId);
        } else {
          setRunDetail(null);
        }
      } catch (loadError) {
        setRunsState("idle");
        setMonitorError(
          loadError instanceof Error ? loadError.message : "failed to load run history",
        );
      }
    },
    [buildRunQuery],
  );

  const loadRunDetail = async (runId: string) => {
    setSelectedRunId(runId);
    setRunDetailState("loading");
    try {
      const next = await fetchMonitorRunDetail(runId);
      setRunDetail(next);
      setRunDetailState("ready");
      setMonitorError("");
    } catch (loadError) {
      setRunDetailState("idle");
      setMonitorError(loadError instanceof Error ? loadError.message : "failed to load run detail");
    }
  };

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  const loadMoreRuns = async () => {
    if (!monitorNextCursor) {
      return;
    }
    setRunsState("loading");
    try {
      const next = await fetchMonitorRuns(buildRunQuery(monitorNextCursor));
      const nextRuns = next.runs ?? [];
      setMonitorRuns((current) => {
        const seen = new Set(current.map((run) => run.runId));
        return [...current, ...nextRuns.filter((run) => !seen.has(run.runId))];
      });
      setMonitorNextCursor(next.nextCursor ?? null);
      setRunsState("ready");
      setMonitorError("");
    } catch (loadError) {
      setRunsState("idle");
      setMonitorError(
        loadError instanceof Error ? loadError.message : "failed to load more run history",
      );
    }
  };

  const refreshMonitorStats = async () => {
    setStatsState("loading");
    try {
      const next = await fetchMonitorStats();
      setMonitorStats(next);
      setStatsState("ready");
      setMonitorError("");
    } catch (loadError) {
      setStatsState("idle");
      setMonitorError(loadError instanceof Error ? loadError.message : "failed to load stats");
    }
  };

  useEffect(() => {
    void refreshMonitorStats();
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (agentFilter.trim()) {
        const query = agentFilter.trim().toLowerCase();
        const matchesAgent = event.agentId?.toLowerCase().includes(query);
        const matchesName = event.agentName?.toLowerCase().includes(query);
        if (!matchesAgent && !matchesName) {
          return false;
        }
      }
      if (eventTypeFilter && event.type !== eventTypeFilter) {
        return false;
      }
      return withinRange(event.timestamp, timeRange);
    });
  }, [agentFilter, eventTypeFilter, events, timeRange]);

  const selectedEvent =
    filteredEvents.find((event) => event.id === selectedEventId) ??
    filteredEvents[0] ??
    events.find((event) => event.id === selectedEventId) ??
    null;

  const groupedEvents = useMemo(() => {
    const groups = new Map<ActivityTimeGroup, DeckGoActivityEvent[]>();
    for (const event of filteredEvents) {
      const group = getTimeGroup(event.timestamp);
      groups.set(group, [...(groups.get(group) ?? []), event]);
    }
    return GROUP_ORDER.map((group) => ({
      group,
      events: groups.get(group) ?? [],
    })).filter((entry) => entry.events.length > 0);
  }, [filteredEvents]);

  const toggleGroup = (group: ActivityTimeGroup) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const uniqueEventTypes = useMemo(
    () =>
      Array.from(new Set(events.map((event) => event.type))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [events],
  );
  const uniqueAgents = useMemo(
    () => new Set(events.map((event) => event.agentId || event.agentName).filter(Boolean)).size,
    [events],
  );
  const selectedRun = useMemo(
    () => monitorRuns.find((run) => run.runId === selectedRunId) ?? null,
    [monitorRuns, selectedRunId],
  );
  const selectedRunAgentId =
    selectedRun?.agentId ??
    runDetail?.events?.find((event) => typeof event.agent_id === "string")?.agent_id ??
    "";
  const selectedRunSessionKey =
    selectedRun?.sessionKey ??
    runDetail?.events?.find((event) => typeof event.session_key === "string")?.session_key ??
    "";

  const runDiagnostics = useMemo(() => {
    const modelStats = new Map<string, RunModelStat>();
    const toolEvents: RunToolEvent[] = [];
    const fileEvents: RunFileEvent[] = [];
    const subagentEvents: RunSubagentEvent[] = [];

    for (const event of runDetail?.events ?? []) {
      const data = parseRunEventData(event.data);

      if (event.stream === "model" || event.stream === "llm") {
        const model = readString(data.model, readString(data.modelId, "unknown"));
        const usage =
          data.usage && typeof data.usage === "object" && !Array.isArray(data.usage)
            ? (data.usage as Record<string, unknown>)
            : {};
        const current = modelStats.get(model) ?? {
          model,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheTokens: 0,
          fallback: false,
        };
        current.calls += 1;
        current.inputTokens += readNumber(usage.input_tokens ?? usage.inputTokens);
        current.outputTokens += readNumber(usage.output_tokens ?? usage.outputTokens);
        current.cacheTokens += readNumber(
          usage.cache_read_input_tokens ?? usage.cacheReadInputTokens ?? usage.cacheTokens,
        );
        current.fallback = current.fallback || data.isFallback === true || data.fallback === true;
        modelStats.set(model, current);
      }

      if (event.stream === "tool_call" || event.stream === "tool" || event.stream === "file_op") {
        const name = readString(
          data.toolName,
          readString(data.name, event.stream === "file_op" ? "file_op" : "tool_call"),
        );
        toolEvents.push({
          id: event.id,
          name,
          phase: readString(data.phase),
          durationMs: readNumber(data.durationMs),
        });
      }

      if (event.stream === "file_op") {
        const name = readString(data.toolName, readString(data.name, "file"));
        fileEvents.push({
          id: event.id,
          kind: classifyFileOp(name),
          path: readString(data.filePath, readString(data.path, readString(data.file, name))),
        });
      }

      if (event.stream === "subagent") {
        subagentEvents.push({
          id: event.id,
          runId: readString(data.runId, readString(data.childRunId, String(event.id))),
          agentId: readString(data.agentId, readString(data.childAgentId, event.agent_id ?? "")),
          status: readString(data.status, "active"),
          task: readString(data.task),
        });
      }
    }

    return {
      fileEvents,
      modelStats: [...modelStats.values()].toSorted((left, right) => right.calls - left.calls),
      subagentEvents,
      toolEvents,
    };
  }, [runDetail]);

  return (
    <section className="deckgo-panel-workspace deck-ui-activity">
      <div className="deckgo-column deck-ui-activity-column">
        <article className="deckgo-card is-float deck-ui-activity-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Activity</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Recent activity uses the synthesized deck-go event feed, monitor stats, and run history.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-activity-body">
            <div className="deckgo-pill-row deck-ui-activity-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Activity {loadState}
              </span>
              <span className="deckgo-pill">{events.length} loaded</span>
              <span className="deckgo-pill">{filteredEvents.length} visible</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-activity-stats">
              <ShellStat label="events" value={events.length} />
              <ShellStat label="visible" value={filteredEvents.length} />
              <ShellStat label="agents" value={uniqueAgents} />
            </div>
            <div className="deckgo-surface-tile deck-ui-activity-surface">
              <p className="deckgo-surface-label">Filter activity</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-activity-grid">
                <input
                  className="deckgo-input deck-ui-activity-input"
                  value={agentFilter}
                  onChange={(event) => setAgentFilter(event.target.value)}
                  placeholder="agent id or name"
                />
                <select
                  className="deckgo-input deck-ui-activity-input"
                  value={eventTypeFilter}
                  onChange={(event) => setEventTypeFilter(event.target.value)}
                >
                  <option value="">all event types</option>
                  {uniqueEventTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  className="deckgo-input deck-ui-activity-input"
                  value={timeRange}
                  onChange={(event) => setTimeRange(event.target.value as ActivityTimeRange)}
                >
                  <option value="1h">last hour</option>
                  <option value="6h">last 6 hours</option>
                  <option value="24h">last 24 hours</option>
                  <option value="7d">last 7 days</option>
                  <option value="all">all</option>
                </select>
              </div>
              <div className="deckgo-actions deck-ui-activity-actions deck-ui-activity-actions-offset">
                <button
                  className="deckgo-button deck-ui-activity-button"
                  type="button"
                  onClick={() => void refresh(selectedEventId)}
                >
                  Refresh activity
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {filteredEvents.length === 0 ? (
              <p className="deckgo-note">No activity events match the current filters.</p>
            ) : (
              <div className="deckgo-form-grid">
                {groupedEvents.map(({ group, events: groupEvents }) => {
                  const isCollapsed = collapsedGroups.has(group);
                  return (
                    <section className="deckgo-surface-tile deck-ui-activity-surface" key={group}>
                      <button
                        type="button"
                        className="deckgo-button deck-ui-activity-button"
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleGroup(group)}
                      >
                        {GROUP_LABELS[group]} ({groupEvents.length})
                      </button>
                      {!isCollapsed ? (
                        <ul className="deckgo-shell-list deck-ui-activity-list deck-ui-activity-list-offset">
                          {groupEvents.map((event) => (
                            <li key={event.id}>
                              <button
                                type="button"
                                className={`deckgo-selectable-card deck-ui-activity-row ${selectedEvent?.id === event.id ? "is-selected" : ""}`}
                                onClick={() => setSelectedEventId(event.id)}
                              >
                                <strong>{event.description}</strong>
                                <div className="deckgo-meta">
                                  {event.type} | {event.agentName || event.agentId || "system"}
                                </div>
                                <div className="deckgo-meta">
                                  {new Date(event.timestamp).toLocaleString()}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </article>

        <article className="deckgo-card is-float deck-ui-activity-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Run history</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Current monitor runs from deck-go&apos;s projection-backed run history.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-activity-body">
            <div className="deckgo-pill-row deck-ui-activity-status-row">
              <span className={`deckgo-pill ${runsState === "ready" ? "is-positive" : "is-muted"}`}>
                Runs {runsState}
              </span>
              <span
                className={`deckgo-pill ${statsState === "ready" ? "is-positive" : "is-muted"}`}
              >
                Stats {statsState}
              </span>
              <span className="deckgo-pill">{monitorRuns.length} loaded</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-activity-stats">
              <ShellStat label="total runs" value={monitorStats?.totalRuns ?? 0} />
              <ShellStat label="today" value={monitorStats?.todayRuns ?? 0} />
              <ShellStat label="avg duration" value={formatDuration(monitorStats?.avgDurationMs)} />
            </div>
            <div className="deckgo-surface-tile deck-ui-activity-surface">
              <p className="deckgo-surface-label">Filter run history</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-activity-grid">
                <input
                  className="deckgo-input deck-ui-activity-input"
                  value={runAgentFilter}
                  onChange={(event) => setRunAgentFilter(event.target.value)}
                  placeholder="run agent id"
                />
                <input
                  className="deckgo-input deck-ui-activity-input"
                  value={runSessionFilter}
                  onChange={(event) => setRunSessionFilter(event.target.value)}
                  placeholder="run session key"
                />
                <select
                  aria-label="run status filter"
                  className="deckgo-input deck-ui-activity-input"
                  value={runStatusFilter}
                  onChange={(event) =>
                    setRunStatusFilter(event.target.value as MonitorRunStatusFilter)
                  }
                >
                  {MONITOR_RUN_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status === "all" ? "all statuses" : status}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="run time range"
                  className="deckgo-input deck-ui-activity-input"
                  value={runTimeRange}
                  onChange={(event) => setRunTimeRange(event.target.value as ActivityTimeRange)}
                >
                  <option value="1h">last hour</option>
                  <option value="6h">last 6 hours</option>
                  <option value="24h">last 24 hours</option>
                  <option value="7d">last 7 days</option>
                  <option value="all">all runs</option>
                </select>
              </div>
              {runAgentFilter ||
              runSessionFilter ||
              runStatusFilter !== "all" ||
              runTimeRange !== "all" ? (
                <div className="deckgo-actions deck-ui-activity-actions deck-ui-activity-actions-offset">
                  <button
                    className="deckgo-button deck-ui-activity-button"
                    type="button"
                    onClick={() => {
                      setRunAgentFilter("");
                      setRunSessionFilter("");
                      setRunStatusFilter("all");
                      setRunTimeRange("all");
                    }}
                  >
                    Clear run filters
                  </button>
                </div>
              ) : null}
            </div>
            {monitorStats?.topAgents?.length ? (
              <div className="deckgo-surface-tile deck-ui-activity-surface">
                <p className="deckgo-surface-label">Top agents</p>
                <div className="deckgo-pill-row deck-ui-activity-status-row">
                  {monitorStats.topAgents.map((agent) => (
                    <button
                      className="deckgo-pill"
                      key={agent.agentId}
                      type="button"
                      onClick={() => navigateToAgent(ui, agent.agentId)}
                    >
                      {agent.agentId} {agent.runCount}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="deckgo-actions deck-ui-activity-actions">
              <button
                className="deckgo-button deck-ui-activity-button"
                type="button"
                onClick={() => void refreshRuns(selectedRunId)}
              >
                Refresh runs
              </button>
              {monitorNextCursor ? (
                <button
                  className="deckgo-button deck-ui-activity-button"
                  type="button"
                  onClick={() => void loadMoreRuns()}
                >
                  Load more runs
                </button>
              ) : null}
              <button
                className="deckgo-button deck-ui-activity-button"
                type="button"
                onClick={() => void refreshMonitorStats()}
              >
                Refresh stats
              </button>
            </div>
            {monitorError ? <p className="deckgo-note">{monitorError}</p> : null}
            {monitorRuns.length ? (
              <div className="deckgo-form-grid">
                {monitorRuns.map((run) => (
                  <button
                    key={run.runId}
                    type="button"
                    className={`deckgo-selectable-card deck-ui-activity-row ${selectedRunId === run.runId ? "is-selected" : ""}`}
                    onClick={() => void loadRunDetail(run.runId)}
                  >
                    <strong>{run.runId}</strong>
                    <div className="deckgo-meta">
                      {run.status} | agent {run.agentId || "n/a"} | events {run.eventCount}
                    </div>
                    <div className="deckgo-meta">
                      tools {run.toolCalls} | models {run.modelCalls} | tokens {run.totalTokens}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="deckgo-note">No monitor runs reported.</p>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-activity-column deck-ui-activity-inspector">
        <article className="deckgo-card is-float deck-ui-activity-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected event</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Read live timeline buckets, inspect event details, and review parsed monitor/run
            diagnostics.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-activity-body">
            {selectedEvent ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-activity-hero">
                  <div>
                    <p className="deckgo-kicker">Event</p>
                    <strong>{selectedEvent.description}</strong>
                    <p className="deckgo-note">{selectedEvent.id}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-activity-status-row">
                    <span className="deckgo-pill">{selectedEvent.type}</span>
                    <span className="deckgo-pill">
                      {selectedEvent.agentName || selectedEvent.agentId || "system"}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-activity-grid">
                  <ShellStat
                    label="timestamp"
                    value={new Date(selectedEvent.timestamp).toLocaleString()}
                  />
                  <ShellStat label="type" value={selectedEvent.type} />
                </div>
                {selectedEvent.agentId ? (
                  <div className="deckgo-actions deck-ui-activity-actions">
                    <button
                      className="deckgo-button deck-ui-activity-button"
                      type="button"
                      onClick={() => navigateToAgent(ui, selectedEvent.agentId ?? "")}
                    >
                      Open event agent
                    </button>
                  </div>
                ) : null}
                {selectedEvent.details ? (
                  <div className="deckgo-surface-tile deck-ui-activity-surface">
                    <p className="deckgo-surface-label">Details</p>
                    <p className="deckgo-note">{selectedEvent.details}</p>
                  </div>
                ) : null}
                <JsonDetails title="Event payload" payload={selectedEvent} />
              </>
            ) : (
              <p className="deckgo-note">Choose an activity event to inspect it.</p>
            )}
          </div>
        </article>

        <article className="deckgo-card is-float deck-ui-activity-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected run</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Summary and event rows from the current `/monitor/runs/:runId` facade.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-activity-body">
            {selectedRunId ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-activity-hero">
                  <div>
                    <p className="deckgo-kicker">Run</p>
                    <strong>{selectedRunId}</strong>
                    <p className="deckgo-note">detail {runDetailState}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-activity-status-row">
                    <span className="deckgo-pill">
                      events {runDetail?.summary?.eventCount ?? runDetail?.events?.length ?? 0}
                    </span>
                    <span className="deckgo-pill">
                      tokens {runDetail?.summary?.totalTokens ?? 0}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-activity-grid">
                  <ShellStat label="tool calls" value={runDetail?.summary?.toolCalls ?? 0} />
                  <ShellStat label="model calls" value={runDetail?.summary?.modelCalls ?? 0} />
                  <ShellStat label="file ops" value={runDetail?.summary?.fileOps ?? 0} />
                  <ShellStat label="subagents" value={runDetail?.summary?.subagentSpawns ?? 0} />
                  <ShellStat
                    label="duration"
                    value={formatDuration(runDetail?.summary?.durationMs)}
                  />
                  <ShellStat
                    label="input tokens"
                    value={formatTokenCount(runDetail?.summary?.totalInputTokens)}
                  />
                  <ShellStat
                    label="output tokens"
                    value={formatTokenCount(runDetail?.summary?.totalOutputTokens)}
                  />
                  <ShellStat
                    label="cache tokens"
                    value={formatTokenCount(runDetail?.summary?.totalCacheTokens)}
                  />
                  <ShellStat
                    label="compacted"
                    value={runDetail?.summary?.compacted ? "yes" : "no"}
                  />
                </div>
                <div className="deckgo-actions deck-ui-activity-actions">
                  {selectedRunAgentId ? (
                    <button
                      className="deckgo-button deck-ui-activity-button"
                      type="button"
                      onClick={() => navigateToAgent(ui, selectedRunAgentId)}
                    >
                      Open run agent
                    </button>
                  ) : null}
                  {selectedRunSessionKey ? (
                    <button
                      className="deckgo-button deck-ui-activity-button"
                      type="button"
                      onClick={() => navigateToSession(ui, selectedRunSessionKey)}
                    >
                      Open run session
                    </button>
                  ) : null}
                </div>
                {runDiagnostics.modelStats.length ? (
                  <div className="deckgo-surface-tile deck-ui-activity-surface">
                    <p className="deckgo-surface-label">Model stats</p>
                    <div className="deckgo-form-grid">
                      {runDiagnostics.modelStats.slice(0, 5).map((stat) => (
                        <div
                          className="deckgo-selectable-card deck-ui-activity-row"
                          key={stat.model}
                        >
                          <strong>{stat.model}</strong>
                          <div className="deckgo-meta">
                            calls {stat.calls} | input {formatTokenCount(stat.inputTokens)} | output{" "}
                            {formatTokenCount(stat.outputTokens)} | cache{" "}
                            {formatTokenCount(stat.cacheTokens)}
                          </div>
                          {stat.fallback ? <div className="deckgo-meta">fallback used</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {runDiagnostics.toolEvents.length ? (
                  <div className="deckgo-surface-tile deck-ui-activity-surface">
                    <p className="deckgo-surface-label">Tool calls</p>
                    <div className="deckgo-form-grid">
                      {runDiagnostics.toolEvents.slice(0, 5).map((event) => (
                        <div className="deckgo-selectable-card deck-ui-activity-row" key={event.id}>
                          <strong>{event.name}</strong>
                          <div className="deckgo-meta">
                            {event.phase || "event"} | {formatDuration(event.durationMs)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {runDiagnostics.fileEvents.length ? (
                  <div className="deckgo-surface-tile deck-ui-activity-surface">
                    <p className="deckgo-surface-label">File operations</p>
                    <div className="deckgo-form-grid">
                      {runDiagnostics.fileEvents.slice(0, 5).map((event) => (
                        <div className="deckgo-selectable-card deck-ui-activity-row" key={event.id}>
                          <strong>{event.kind}</strong>
                          <div className="deckgo-meta">{event.path}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {runDiagnostics.subagentEvents.length ? (
                  <div className="deckgo-surface-tile deck-ui-activity-surface">
                    <p className="deckgo-surface-label">Subagent events</p>
                    <div className="deckgo-form-grid">
                      {runDiagnostics.subagentEvents.slice(0, 5).map((event) => (
                        <div className="deckgo-selectable-card deck-ui-activity-row" key={event.id}>
                          <strong>{event.runId}</strong>
                          <div className="deckgo-meta">
                            {event.agentId || "agent"} | {event.status}
                          </div>
                          {event.task ? <div className="deckgo-meta">{event.task}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {runDetail?.events?.length ? (
                  <div className="deckgo-surface-tile deck-ui-activity-surface">
                    <p className="deckgo-surface-label">Run events</p>
                    <div className="deckgo-form-grid">
                      {runDetail.events.slice(0, 5).map((event) => (
                        <div className="deckgo-selectable-card deck-ui-activity-row" key={event.id}>
                          <strong>
                            #{event.seq} {event.stream}
                          </strong>
                          <div className="deckgo-meta">
                            {event.agent_id || "system"} | {event.created_at}
                          </div>
                          <div className="deckgo-meta">{event.data}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <JsonDetails title="Run detail payload" payload={runDetail} />
              </>
            ) : (
              <p className="deckgo-note">Choose a monitor run to inspect it.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
