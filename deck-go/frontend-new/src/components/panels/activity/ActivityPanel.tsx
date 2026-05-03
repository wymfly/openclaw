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
import { useTranslations } from "../../../i18n/provider";
import { formatDuration, formatTokenCount } from "../../../lib/format-utils";
import {
  GatewayNotConfiguredEmptyState,
  gatewayNotConfiguredValue,
  isGatewayNotConfiguredValue,
} from "../../runtime/GatewayNotConfiguredEmptyState";
import { JsonDetails } from "../../shared/ShellComponents";
import { useActivitySSE } from "./useActivitySSE";
import "./activity-panel.css";

type PanelState = "idle" | "loading" | "ready";
type ActivityTimeRange = "1h" | "6h" | "24h" | "7d" | "all";
type ActivityTimeGroup = "today" | "yesterday" | "thisWeek" | "older";
type MonitorRunStatusFilter = "all" | "running" | "completed" | "error";
type MonitorRunQuery = Parameters<typeof fetchMonitorRuns>[0];

const GROUP_ORDER: ActivityTimeGroup[] = ["today", "yesterday", "thisWeek", "older"];
const GROUP_LABEL_KEYS: Record<ActivityTimeGroup, string> = {
  today: "today",
  yesterday: "yesterday",
  thisWeek: "thisWeek",
  older: "older",
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

function ActivityMetric(props: {
  label: string;
  value: string | number;
  tone?: "positive" | "warning" | "danger";
}) {
  return (
    <div className={`activity-panel__metric ${props.tone ? `is-${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

export function ActivityPanel() {
  const t = useTranslations("activity");
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
      setError(gatewayNotConfiguredValue(loadError, t("failedLoadActivity")));
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
        setMonitorError(gatewayNotConfiguredValue(loadError, t("failedLoadRunHistory")));
      }
    },
    [buildRunQuery, t],
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
      setMonitorError(gatewayNotConfiguredValue(loadError, t("failedLoadRunDetail")));
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
      setMonitorError(gatewayNotConfiguredValue(loadError, t("failedLoadMoreRunHistory")));
    }
  };

  const refreshMonitorStats = async () => {
    setStatsState("loading");
    try {
      const next = await fetchMonitorStats();
      setMonitorStats(next);
      setStatsState("ready");
    } catch (loadError) {
      setStatsState("idle");
      setMonitorError(loadError instanceof Error ? loadError.message : t("failedLoadStats"));
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
  const activityNotConfigured = isGatewayNotConfiguredValue(error);
  const monitorNotConfigured = isGatewayNotConfiguredValue(monitorError);

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
    <section className="activity-panel" data-testid="activity-panel">
      <header className="activity-panel__header">
        <div className="activity-panel__title-stack">
          <p className="activity-panel__eyebrow">{t("title")}</p>
          <h2 className="activity-panel__title">{t("activityTitle")}</h2>
          <p className="activity-panel__description">{t("activityDescription")}</p>
        </div>
        <div className="activity-panel__header-actions">
          <span className={`activity-panel__pill ${loadState === "ready" ? "is-positive" : ""}`}>
            {t("activityStatus", { state: t(loadState) })}
          </span>
          <span className={`activity-panel__pill ${runsState === "ready" ? "is-positive" : ""}`}>
            {t("runsStatus", { state: t(runsState) })}
          </span>
          <span className={`activity-panel__pill ${statsState === "ready" ? "is-positive" : ""}`}>
            {t("statsStatus", { state: t(statsState) })}
          </span>
        </div>
      </header>

      <div className="activity-panel__workspace">
        <article className="activity-panel__card activity-panel__timeline-card">
          <div className="activity-panel__card-head">
            <div>
              <p className="activity-panel__eyebrow">{t("filterActivity")}</p>
              <h3 className="activity-panel__card-title">{t("activityTitle")}</h3>
            </div>
            <div className="activity-panel__pill-row">
              <span className="activity-panel__pill">
                {t("loadedCount", { count: events.length })}
              </span>
              <span className="activity-panel__pill">
                {t("visibleCount", { count: filteredEvents.length })}
              </span>
            </div>
          </div>

          <div className="activity-panel__body">
            <div className="activity-panel__metrics">
              <ActivityMetric
                label={t("eventsLower")}
                tone={loadState === "ready" ? "positive" : undefined}
                value={events.length}
              />
              <ActivityMetric label={t("visibleLower")} value={filteredEvents.length} />
              <ActivityMetric label={t("agentsLower")} value={uniqueAgents} />
            </div>

            <div className="activity-panel__surface">
              <p className="activity-panel__label">{t("filterActivity")}</p>
              <div className="activity-panel__filter-grid">
                <input
                  className="activity-panel__input"
                  value={agentFilter}
                  onChange={(event) => setAgentFilter(event.target.value)}
                  placeholder={t("agentFilterPlaceholder")}
                />
                <select
                  className="activity-panel__input"
                  value={eventTypeFilter}
                  onChange={(event) => setEventTypeFilter(event.target.value)}
                >
                  <option value="">{t("allEventTypes")}</option>
                  {uniqueEventTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  className="activity-panel__input"
                  value={timeRange}
                  onChange={(event) => setTimeRange(event.target.value as ActivityTimeRange)}
                >
                  <option value="1h">{t("lastHourLower")}</option>
                  <option value="6h">{t("last6HoursLower")}</option>
                  <option value="24h">{t("last24HoursLower")}</option>
                  <option value="7d">{t("last7DaysLower")}</option>
                  <option value="all">{t("allLower")}</option>
                </select>
                <button
                  className="activity-panel__button is-primary"
                  type="button"
                  onClick={() => void refresh(selectedEventId)}
                >
                  {t("refreshActivity")}
                </button>
              </div>
            </div>

            {activityNotConfigured ? (
              <GatewayNotConfiguredEmptyState className="activity-panel__surface" />
            ) : error ? (
              <p className="activity-panel__note is-error">{error}</p>
            ) : null}

            {activityNotConfigured ? null : filteredEvents.length === 0 ? (
              <p className="activity-panel__note">{t("noFilteredActivity")}</p>
            ) : (
              <div className="activity-panel__group-stack">
                {groupedEvents.map(({ group, events: groupEvents }) => {
                  const isCollapsed = collapsedGroups.has(group);
                  return (
                    <section className="activity-panel__surface" key={group}>
                      <button
                        type="button"
                        className="activity-panel__group-button"
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleGroup(group)}
                      >
                        <span>
                          {t(GROUP_LABEL_KEYS[group])} ({groupEvents.length})
                        </span>
                        <span className="activity-panel__pill">
                          {isCollapsed ? t("idle") : t("ready")}
                        </span>
                      </button>
                      {!isCollapsed ? (
                        <ul className="activity-panel__list">
                          {groupEvents.map((event) => (
                            <li key={event.id}>
                              <button
                                type="button"
                                className={`activity-panel__row ${selectedEvent?.id === event.id ? "is-selected" : ""}`}
                                onClick={() => setSelectedEventId(event.id)}
                              >
                                <strong>{event.description}</strong>
                                <span className="activity-panel__meta">
                                  {t("eventMeta", {
                                    agent: event.agentName || event.agentId || t("system"),
                                    type: event.type,
                                  })}
                                </span>
                                <span className="activity-panel__meta">
                                  {new Date(event.timestamp).toLocaleString()}
                                </span>
                                <span className="activity-panel__mono">{event.id}</span>
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

        <article className="activity-panel__card activity-panel__runs-card">
          <div className="activity-panel__card-head">
            <div>
              <p className="activity-panel__eyebrow">{t("filterRunHistory")}</p>
              <h3 className="activity-panel__card-title">{t("runHistory")}</h3>
            </div>
            <span className="activity-panel__pill">
              {t("loadedCount", { count: monitorRuns.length })}
            </span>
          </div>

          <div className="activity-panel__body">
            <p className="activity-panel__description">{t("runHistoryDescription")}</p>
            <div className="activity-panel__metrics">
              <ActivityMetric label={t("totalRuns")} value={monitorStats?.totalRuns ?? 0} />
              <ActivityMetric label={t("todayLower")} value={monitorStats?.todayRuns ?? 0} />
              <ActivityMetric
                label={t("avgDuration")}
                value={formatDuration(monitorStats?.avgDurationMs)}
              />
            </div>

            <div className="activity-panel__surface">
              <p className="activity-panel__label">{t("filterRunHistory")}</p>
              <div className="activity-panel__filter-grid">
                <input
                  className="activity-panel__input"
                  value={runAgentFilter}
                  onChange={(event) => setRunAgentFilter(event.target.value)}
                  placeholder={t("runAgentIdPlaceholder")}
                />
                <input
                  className="activity-panel__input"
                  value={runSessionFilter}
                  onChange={(event) => setRunSessionFilter(event.target.value)}
                  placeholder={t("runSessionKeyPlaceholder")}
                />
                <select
                  aria-label={t("runStatusFilter")}
                  className="activity-panel__input"
                  value={runStatusFilter}
                  onChange={(event) =>
                    setRunStatusFilter(event.target.value as MonitorRunStatusFilter)
                  }
                >
                  {MONITOR_RUN_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status === "all" ? t("allStatuses") : status}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t("runTimeRange")}
                  className="activity-panel__input"
                  value={runTimeRange}
                  onChange={(event) => setRunTimeRange(event.target.value as ActivityTimeRange)}
                >
                  <option value="1h">{t("lastHourLower")}</option>
                  <option value="6h">{t("last6HoursLower")}</option>
                  <option value="24h">{t("last24HoursLower")}</option>
                  <option value="7d">{t("last7DaysLower")}</option>
                  <option value="all">{t("allRuns")}</option>
                </select>
              </div>
              {runAgentFilter ||
              runSessionFilter ||
              runStatusFilter !== "all" ||
              runTimeRange !== "all" ? (
                <div className="activity-panel__actions">
                  <button
                    className="activity-panel__button"
                    type="button"
                    onClick={() => {
                      setRunAgentFilter("");
                      setRunSessionFilter("");
                      setRunStatusFilter("all");
                      setRunTimeRange("all");
                    }}
                  >
                    {t("clearRunFilters")}
                  </button>
                </div>
              ) : null}
            </div>

            {monitorStats?.topAgents?.length ? (
              <div className="activity-panel__surface">
                <p className="activity-panel__label">{t("topAgents")}</p>
                <div className="activity-panel__pill-row">
                  {monitorStats.topAgents.map((agent) => (
                    <button
                      className="activity-panel__pill activity-panel__shortcut"
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

            <div className="activity-panel__actions">
              <button
                className="activity-panel__button is-primary"
                type="button"
                onClick={() => void refreshRuns(selectedRunId)}
              >
                {t("refreshRuns")}
              </button>
              {monitorNextCursor ? (
                <button
                  className="activity-panel__button"
                  type="button"
                  onClick={() => void loadMoreRuns()}
                >
                  {t("loadMoreRuns")}
                </button>
              ) : null}
              <button
                className="activity-panel__button"
                type="button"
                onClick={() => void refreshMonitorStats()}
              >
                {t("refreshStats")}
              </button>
            </div>

            {monitorNotConfigured ? (
              <GatewayNotConfiguredEmptyState className="activity-panel__surface" />
            ) : monitorError ? (
              <p className="activity-panel__note is-error">{monitorError}</p>
            ) : null}

            {monitorNotConfigured ? null : monitorRuns.length ? (
              <div className="activity-panel__run-list">
                {monitorRuns.map((run) => (
                  <button
                    key={run.runId}
                    type="button"
                    className={`activity-panel__row ${selectedRunId === run.runId ? "is-selected" : ""}`}
                    onClick={() => void loadRunDetail(run.runId)}
                  >
                    <strong className="activity-panel__mono">{run.runId}</strong>
                    <span className="activity-panel__meta">
                      {t("runMeta", {
                        agent: run.agentId || t("na"),
                        eventCount: run.eventCount,
                        status: run.status,
                      })}
                    </span>
                    <span className="activity-panel__meta">
                      {t("runUsageMeta", {
                        modelCalls: run.modelCalls,
                        tokens: run.totalTokens,
                        toolCalls: run.toolCalls,
                      })}
                    </span>
                    <span className="activity-panel__meta">
                      {run.firstEventAt} to {run.lastEventAt}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="activity-panel__note">{t("noMonitorRuns")}</p>
            )}
          </div>
        </article>

        <div className="activity-panel__inspector">
          <article className="activity-panel__card">
            <div className="activity-panel__card-head">
              <div>
                <p className="activity-panel__eyebrow">{t("event")}</p>
                <h3 className="activity-panel__card-title">{t("selectedEvent")}</h3>
              </div>
            </div>
            <div className="activity-panel__body">
              <p className="activity-panel__description">{t("selectedEventDescription")}</p>
              {selectedEvent ? (
                <>
                  <div className="activity-panel__hero">
                    <div>
                      <p className="activity-panel__label">{t("event")}</p>
                      <strong>{selectedEvent.description}</strong>
                      <p className="activity-panel__mono">{selectedEvent.id}</p>
                    </div>
                    <div className="activity-panel__pill-row">
                      <span className="activity-panel__pill">{selectedEvent.type}</span>
                      <span className="activity-panel__pill">
                        {selectedEvent.agentName || selectedEvent.agentId || t("system")}
                      </span>
                    </div>
                  </div>
                  <div className="activity-panel__metrics is-two">
                    <ActivityMetric
                      label={t("timestamp")}
                      value={new Date(selectedEvent.timestamp).toLocaleString()}
                    />
                    <ActivityMetric label={t("type")} value={selectedEvent.type} />
                  </div>
                  {selectedEvent.agentId ? (
                    <div className="activity-panel__actions">
                      <button
                        className="activity-panel__button"
                        type="button"
                        onClick={() => navigateToAgent(ui, selectedEvent.agentId ?? "")}
                      >
                        {t("openEventAgent")}
                      </button>
                    </div>
                  ) : null}
                  {selectedEvent.details ? (
                    <div className="activity-panel__surface">
                      <p className="activity-panel__label">{t("details")}</p>
                      <p className="activity-panel__note">{selectedEvent.details}</p>
                    </div>
                  ) : null}
                  <JsonDetails title={t("eventPayload")} payload={selectedEvent} />
                </>
              ) : (
                <p className="activity-panel__note">{t("chooseActivityEvent")}</p>
              )}
            </div>
          </article>

          <article className="activity-panel__card">
            <div className="activity-panel__card-head">
              <div>
                <p className="activity-panel__eyebrow">{t("run")}</p>
                <h3 className="activity-panel__card-title">{t("selectedRun")}</h3>
              </div>
            </div>
            <div className="activity-panel__body">
              <p className="activity-panel__description">{t("selectedRunDescription")}</p>
              {selectedRunId ? (
                <>
                  <div className="activity-panel__hero">
                    <div>
                      <p className="activity-panel__label">{t("run")}</p>
                      <strong className="activity-panel__mono">{selectedRunId}</strong>
                      <p className="activity-panel__note">
                        {t("detailStatus", { state: t(runDetailState) })}
                      </p>
                    </div>
                    <div className="activity-panel__pill-row">
                      <span className="activity-panel__pill">
                        {t("eventsCount", {
                          count: runDetail?.summary?.eventCount ?? runDetail?.events?.length ?? 0,
                        })}
                      </span>
                      <span className="activity-panel__pill">
                        {t("tokensCount", { count: runDetail?.summary?.totalTokens ?? 0 })}
                      </span>
                    </div>
                  </div>
                  <div className="activity-panel__metrics is-run-detail">
                    <ActivityMetric
                      label={t("toolCalls")}
                      value={runDetail?.summary?.toolCalls ?? 0}
                    />
                    <ActivityMetric
                      label={t("modelCalls")}
                      value={runDetail?.summary?.modelCalls ?? 0}
                    />
                    <ActivityMetric label={t("fileOps")} value={runDetail?.summary?.fileOps ?? 0} />
                    <ActivityMetric
                      label={t("subagents")}
                      value={runDetail?.summary?.subagentSpawns ?? 0}
                    />
                    <ActivityMetric
                      label={t("duration")}
                      value={formatDuration(runDetail?.summary?.durationMs)}
                    />
                    <ActivityMetric
                      label={t("inputTokens")}
                      value={formatTokenCount(runDetail?.summary?.totalInputTokens)}
                    />
                    <ActivityMetric
                      label={t("outputTokens")}
                      value={formatTokenCount(runDetail?.summary?.totalOutputTokens)}
                    />
                    <ActivityMetric
                      label={t("cacheTokens")}
                      value={formatTokenCount(runDetail?.summary?.totalCacheTokens)}
                    />
                    <ActivityMetric
                      label={t("compacted")}
                      value={runDetail?.summary?.compacted ? t("yes") : t("no")}
                    />
                  </div>
                  <div className="activity-panel__actions">
                    {selectedRunAgentId ? (
                      <button
                        className="activity-panel__button"
                        type="button"
                        onClick={() => navigateToAgent(ui, selectedRunAgentId)}
                      >
                        {t("openRunAgent")}
                      </button>
                    ) : null}
                    {selectedRunSessionKey ? (
                      <button
                        className="activity-panel__button"
                        type="button"
                        onClick={() => navigateToSession(ui, selectedRunSessionKey)}
                      >
                        {t("openRunSession")}
                      </button>
                    ) : null}
                  </div>
                  {runDiagnostics.modelStats.length ? (
                    <div className="activity-panel__surface">
                      <p className="activity-panel__label">{t("modelStats")}</p>
                      <div className="activity-panel__diagnostic-grid">
                        {runDiagnostics.modelStats.slice(0, 5).map((stat) => (
                          <div className="activity-panel__row" key={stat.model}>
                            <strong>{stat.model}</strong>
                            <span className="activity-panel__meta">
                              {t("modelStatsMeta", {
                                cache: formatTokenCount(stat.cacheTokens),
                                calls: stat.calls,
                                input: formatTokenCount(stat.inputTokens),
                                output: formatTokenCount(stat.outputTokens),
                              })}
                            </span>
                            {stat.fallback ? (
                              <span className="activity-panel__meta">{t("fallbackUsed")}</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {runDiagnostics.toolEvents.length ? (
                    <div className="activity-panel__surface">
                      <p className="activity-panel__label">{t("toolCallsTitle")}</p>
                      <div className="activity-panel__diagnostic-grid">
                        {runDiagnostics.toolEvents.slice(0, 5).map((event) => (
                          <div className="activity-panel__row" key={event.id}>
                            <strong>{event.name}</strong>
                            <span className="activity-panel__meta">
                              {event.phase || t("eventFallback")} |{" "}
                              {formatDuration(event.durationMs)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {runDiagnostics.fileEvents.length ? (
                    <div className="activity-panel__surface">
                      <p className="activity-panel__label">{t("fileOperations")}</p>
                      <div className="activity-panel__diagnostic-grid">
                        {runDiagnostics.fileEvents.slice(0, 5).map((event) => (
                          <div className="activity-panel__row" key={event.id}>
                            <strong>{event.kind}</strong>
                            <span className="activity-panel__meta">{event.path}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {runDiagnostics.subagentEvents.length ? (
                    <div className="activity-panel__surface">
                      <p className="activity-panel__label">{t("subagentEvents")}</p>
                      <div className="activity-panel__diagnostic-grid">
                        {runDiagnostics.subagentEvents.slice(0, 5).map((event) => (
                          <div className="activity-panel__row" key={event.id}>
                            <strong>{event.runId}</strong>
                            <span className="activity-panel__meta">
                              {event.agentId || t("agentFallback")} | {event.status}
                            </span>
                            {event.task ? (
                              <span className="activity-panel__meta">{event.task}</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {runDetail?.events?.length ? (
                    <div className="activity-panel__surface">
                      <p className="activity-panel__label">{t("runEvents")}</p>
                      <div className="activity-panel__diagnostic-grid">
                        {runDetail.events.slice(0, 5).map((event) => (
                          <div className="activity-panel__row" key={event.id}>
                            <strong>
                              #{event.seq} {event.stream}
                            </strong>
                            <span className="activity-panel__meta">
                              {t("runEventMeta", {
                                agent: event.agent_id || t("system"),
                                createdAt: event.created_at,
                              })}
                            </span>
                            <span className="activity-panel__meta">{event.data}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <JsonDetails title={t("runDetailPayload")} payload={runDetail} />
                </>
              ) : (
                <p className="activity-panel__note">{t("chooseMonitorRun")}</p>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
