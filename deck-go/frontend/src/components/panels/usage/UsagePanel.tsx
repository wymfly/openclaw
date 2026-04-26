import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DeckGoContextWeightReport,
  DeckGoUsageCostEntry,
  DeckGoUsageSessionEntry,
  DeckGoUsageSessionLogEntry,
  DeckGoUsageSessionsResponse,
  DeckGoUsageTimePoint,
  DeckGoUsageProviderStatus,
  DeckGoUsageProviderWindow,
} from "../../../api";
import {
  fetchModelUsageCost,
  fetchModelUsageProviders,
  fetchUsageSessionLogs,
  fetchUsageSessions,
  fetchUsageTimeseries,
} from "../../../api";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { buildUsageModelTrendRows, buildUsageTrendRows } from "./usage-trend";
import { UsageTrendChart } from "./UsageTrendChart";

type PanelState = "idle" | "loading" | "ready";

const USAGE_RANGE_SHORTCUTS = [
  { days: "1", label: "Today" },
  { days: "7", label: "7d" },
  { days: "14", label: "14d" },
  { days: "30", label: "30d" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatReset(resetAt?: number) {
  if (!resetAt) {
    return "n/a";
  }
  const remaining = Math.max(0, resetAt - Date.now());
  const hours = Math.floor(remaining / (60 * 60 * 1_000));
  const minutes = Math.floor((remaining % (60 * 60 * 1_000)) / (60 * 1_000));
  return `${hours}h ${minutes}m`;
}

function parseUsageDays(value: string) {
  const parsedDays = Number.parseInt(value, 10);
  return Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : undefined;
}

function localDateString(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function usageRangeFromDays(daysValue: string) {
  const parsedDays = parseUsageDays(daysValue) ?? 14;
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - parsedDays + 1);
  return {
    endDate: localDateString(end),
    startDate: localDateString(start),
  };
}

function usageEntryCost(entry: DeckGoUsageSessionEntry) {
  return entry.usage?.totalCost ?? 0;
}

function usageEntryTokens(entry: DeckGoUsageSessionEntry) {
  return entry.usage?.totalTokens ?? 0;
}

function formatTimestamp(timestamp?: number) {
  if (!timestamp) {
    return "n/a";
  }
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "n/a" : date.toLocaleString();
}

function formatChars(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

function formatDurationMs(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}s`;
  }
  return `${Math.round(value)}ms`;
}

function usageAggregateRows(response: DeckGoUsageSessionsResponse | null) {
  const aggregates = response?.aggregates;
  if (!aggregates) {
    return [];
  }
  return [
    ...(aggregates.byModel ?? []).map((entry) => ({
      kind: "model",
      label: entry.model || "unknown model",
      totals: entry.totals,
    })),
    ...(aggregates.byProvider ?? []).map((entry) => ({
      kind: "provider",
      label: entry.provider || "unknown provider",
      totals: entry.totals,
    })),
    ...(aggregates.byAgent ?? []).map((entry) => ({
      kind: "agent",
      label: entry.agentId || "unknown agent",
      totals: entry.totals,
    })),
    ...(aggregates.byChannel ?? []).map((entry) => ({
      kind: "channel",
      label: entry.channel || "unknown channel",
      totals: entry.totals,
    })),
  ].slice(0, 12);
}

function contextWeightSummary(report: DeckGoContextWeightReport) {
  const system = report.systemPrompt.chars;
  const tools = report.tools.listChars + report.tools.schemaChars;
  const skills = report.skills.promptChars;
  const files = report.injectedWorkspaceFiles.reduce((sum, file) => sum + file.injectedChars, 0);
  return {
    files,
    skills,
    system,
    tools,
    total: system + tools + skills + files,
  };
}

export function UsagePanel() {
  const ui = useDeckUI();
  const [days, setDays] = useState("14");
  const [costEntries, setCostEntries] = useState<DeckGoUsageCostEntry[]>([]);
  const [providers, setProviders] = useState<DeckGoUsageProviderStatus[]>([]);
  const [sessionsUsage, setSessionsUsage] = useState<DeckGoUsageSessionsResponse | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const [expandedSessionKey, setExpandedSessionKey] = useState("");
  const [sessionLogs, setSessionLogs] = useState<Record<string, DeckGoUsageSessionLogEntry[]>>({});
  const [sessionTimeseries, setSessionTimeseries] = useState<
    Record<string, DeckGoUsageTimePoint[]>
  >({});
  const [sessionContextWeights, setSessionContextWeights] = useState<
    Record<string, DeckGoContextWeightReport | null>
  >({});
  const [sessionLogsLoading, setSessionLogsLoading] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [error, setError] = useState("");
  const didInitialRefresh = useRef(false);

  const refresh = useCallback(
    async (preferredProviderId?: string, daysValue = days) => {
      setLoadState("loading");
      try {
        const usageRange = usageRangeFromDays(daysValue);
        const [costResult, providersResult, sessionsResult] = await Promise.all([
          fetchModelUsageCost(parseUsageDays(daysValue)),
          fetchModelUsageProviders(),
          fetchUsageSessions({ ...usageRange, limit: 50 }),
        ]);
        const nextCosts = (costResult.daily ?? [])
          .slice()
          .toSorted((left, right) => left.date.localeCompare(right.date));
        const nextProviders = providersResult.providers ?? [];
        setCostEntries(nextCosts);
        setProviders(nextProviders);
        setSessionsUsage(sessionsResult);
        setLoadState("ready");
        setError("");
        const fallbackId = preferredProviderId?.trim() || nextProviders[0]?.provider || "";
        setSelectedProviderId((current) =>
          nextProviders.some((provider) => provider.provider === current)
            ? current
            : nextProviders.some((provider) => provider.provider === fallbackId)
              ? fallbackId
              : nextProviders[0]?.provider || "",
        );
      } catch (loadError) {
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : "failed to load usage");
      }
    },
    [days],
  );

  useEffect(() => {
    if (didInitialRefresh.current) {
      return;
    }
    didInitialRefresh.current = true;
    void refresh();
  }, [refresh]);

  const sessionEntries = useMemo(() => sessionsUsage?.sessions ?? [], [sessionsUsage]);
  const filteredSessionEntries = useMemo(() => {
    const needle = sessionSearch.trim().toLowerCase();
    if (!needle) {
      return sessionEntries;
    }
    return sessionEntries.filter((entry) =>
      [entry.key, entry.label, entry.sessionId, entry.agentId, entry.channel].some((value) =>
        value?.toLowerCase().includes(needle),
      ),
    );
  }, [sessionEntries, sessionSearch]);
  const sessionAggregateRows = useMemo(() => usageAggregateRows(sessionsUsage), [sessionsUsage]);
  const trendRows = useMemo(
    () => buildUsageTrendRows(sessionsUsage, costEntries),
    [costEntries, sessionsUsage],
  );
  const modelTrendRows = useMemo(() => buildUsageModelTrendRows(sessionsUsage), [sessionsUsage]);
  const usageSignals = sessionsUsage?.aggregates ?? null;
  const topTools = useMemo(
    () => (usageSignals?.tools?.tools ?? []).slice(0, 6),
    [usageSignals?.tools?.tools],
  );
  const dailySignals = useMemo(() => (usageSignals?.daily ?? []).slice(-7), [usageSignals?.daily]);
  const totalSessionTokens = sessionsUsage?.totals?.totalTokens ?? 0;
  const totalSessionCost = sessionsUsage?.totals?.totalCost ?? 0;
  const selectedProvider =
    providers.find((provider) => provider.provider === selectedProviderId) ?? providers[0] ?? null;
  const totalCost = useMemo(
    () =>
      costEntries.reduce((sum, entry) => {
        return sum + (entry.totalCost ?? entry.cost ?? 0);
      }, 0),
    [costEntries],
  );
  const hottestWindow = useMemo(() => {
    const windows = providers.flatMap((provider) =>
      provider.windows.map((window) => ({ provider: provider.provider, window })),
    );
    return (
      windows.toSorted((left, right) => right.window.usedPercent - left.window.usedPercent)[0] ??
      null
    );
  }, [providers]);
  const toggleSessionLogs = useCallback(
    async (entry: DeckGoUsageSessionEntry) => {
      if (expandedSessionKey === entry.key) {
        setExpandedSessionKey("");
        return;
      }
      setExpandedSessionKey(entry.key);
      if (
        sessionLogs[entry.key] &&
        sessionTimeseries[entry.key] &&
        Object.hasOwn(sessionContextWeights, entry.key)
      ) {
        return;
      }
      setSessionLogsLoading(true);
      try {
        const [logsResult, timeseriesResult, contextWeightResult] = await Promise.all([
          sessionLogs[entry.key]
            ? Promise.resolve({ logs: sessionLogs[entry.key] })
            : fetchUsageSessionLogs({ key: entry.key, limit: 50 }),
          sessionTimeseries[entry.key]
            ? Promise.resolve({ points: sessionTimeseries[entry.key] })
            : fetchUsageTimeseries({ key: entry.key }),
          Object.hasOwn(sessionContextWeights, entry.key)
            ? Promise.resolve({
                sessions: [{ contextWeight: sessionContextWeights[entry.key], key: entry.key }],
              })
            : fetchUsageSessions({ includeContextWeight: true, key: entry.key, limit: 1 }),
        ]);
        setSessionLogs((current) => ({ ...current, [entry.key]: logsResult.logs ?? [] }));
        setSessionTimeseries((current) => ({
          ...current,
          [entry.key]: timeseriesResult.points ?? [],
        }));
        const contextSession =
          contextWeightResult.sessions?.find((session) => session.key === entry.key) ??
          contextWeightResult.sessions?.[0] ??
          null;
        setSessionContextWeights((current) => ({
          ...current,
          [entry.key]: contextSession?.contextWeight ?? null,
        }));
        setError("");
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "failed to load usage session detail",
        );
      } finally {
        setSessionLogsLoading(false);
      }
    },
    [expandedSessionKey, sessionContextWeights, sessionLogs, sessionTimeseries],
  );

  return (
    <section className="deckgo-panel-workspace deck-ui-usage">
      <div className="deckgo-column deck-ui-usage-column">
        <article className="deckgo-card is-float deck-ui-usage-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Usage</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Cost and provider quota overview uses current model and session usage data.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-usage-body">
            <div className="deckgo-pill-row deck-ui-usage-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Usage {loadState}
              </span>
              <span className="deckgo-pill">{costEntries.length} days</span>
              <span className="deckgo-pill">{providers.length} providers</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-usage-stats">
              <ShellStat label="days" value={costEntries.length} />
              <ShellStat label="providers" value={providers.length} />
              <ShellStat label="total cost" value={formatCurrency(totalCost)} />
            </div>
            <div className="deckgo-surface-tile deck-ui-usage-surface">
              <p className="deckgo-surface-label">Refresh usage range</p>
              <div
                className="deckgo-actions deck-ui-usage-actions"
                role="group"
                aria-label="Usage range shortcuts"
              >
                {USAGE_RANGE_SHORTCUTS.map((shortcut) => (
                  <button
                    className={`deckgo-button deckgo-button-compact deck-ui-usage-button ${
                      days === shortcut.days ? "is-primary" : ""
                    }`}
                    data-usage-range={shortcut.days}
                    key={shortcut.days}
                    type="button"
                    onClick={() => {
                      setDays(shortcut.days);
                      void refresh(selectedProviderId, shortcut.days);
                    }}
                  >
                    {shortcut.label}
                  </button>
                ))}
              </div>
              <div className="deckgo-actions deck-ui-usage-controls">
                <input
                  className="deckgo-input deck-ui-usage-input"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  placeholder="days"
                />
                <button
                  className="deckgo-button deck-ui-usage-button"
                  type="button"
                  onClick={() => void refresh(selectedProviderId)}
                >
                  Refresh usage
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note deck-ui-usage-error">{error}</p> : null}
            <UsageTrendChart dailyRows={trendRows} modelRows={modelTrendRows} />
            <div className="deckgo-surface-tile deck-ui-usage-surface">
              <p className="deckgo-surface-label">Session usage drilldown</p>
              <div className="deckgo-grid deckgo-grid-3 deck-ui-usage-stats">
                <ShellStat label="sessions" value={sessionEntries.length} />
                <ShellStat label="tokens" value={totalSessionTokens} />
                <ShellStat label="session cost" value={formatCurrency(totalSessionCost)} />
              </div>
              <input
                className="deckgo-input deck-ui-usage-input"
                value={sessionSearch}
                onChange={(event) => setSessionSearch(event.target.value)}
                placeholder="search usage sessions"
              />
              {filteredSessionEntries.length === 0 ? (
                <p className="deckgo-note deck-ui-usage-empty">No session usage matched.</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-usage-list">
                  {filteredSessionEntries.map((entry) => {
                    const logs = sessionLogs[entry.key] ?? [];
                    const points = sessionTimeseries[entry.key] ?? [];
                    const hasContextWeight = Object.hasOwn(sessionContextWeights, entry.key);
                    const contextWeight = sessionContextWeights[entry.key] ?? null;
                    const contextSummary = contextWeight
                      ? contextWeightSummary(contextWeight)
                      : null;
                    const isExpanded = expandedSessionKey === entry.key;
                    return (
                      <li key={entry.key}>
                        <button
                          type="button"
                          className={`deckgo-selectable-card deck-ui-usage-row ${isExpanded ? "is-selected" : ""}`}
                          onClick={() => void toggleSessionLogs(entry)}
                        >
                          <strong>{entry.label || entry.key}</strong>
                          <div className="deckgo-meta deck-ui-usage-meta">
                            {entry.agentId || "unknown agent"} |{" "}
                            {entry.channel || "unknown channel"} | updated{" "}
                            {formatTimestamp(entry.updatedAt)}
                          </div>
                          <div className="deckgo-pill-row deck-ui-usage-status-row">
                            <span className="deckgo-pill">{usageEntryTokens(entry)} tokens</span>
                            <span className="deckgo-pill">
                              {formatCurrency(usageEntryCost(entry))}
                            </span>
                          </div>
                        </button>
                        {isExpanded ? (
                          <div className="deckgo-surface-tile deck-ui-usage-surface deck-ui-usage-detail">
                            <p className="deckgo-surface-label">Session logs</p>
                            <div className="deckgo-actions deck-ui-usage-actions">
                              {entry.agentId ? (
                                <button
                                  className="deckgo-button deck-ui-usage-button"
                                  type="button"
                                  onClick={() => navigateToAgent(ui, entry.agentId ?? "")}
                                >
                                  Open usage agent
                                </button>
                              ) : null}
                              <button
                                className="deckgo-button deck-ui-usage-button"
                                type="button"
                                onClick={() => navigateToSession(ui, entry.key)}
                              >
                                Open usage session
                              </button>
                            </div>
                            {sessionLogsLoading && logs.length === 0 ? (
                              <p className="deckgo-note deck-ui-usage-empty">
                                Loading session logs...
                              </p>
                            ) : logs.length === 0 ? (
                              <p className="deckgo-note deck-ui-usage-empty">
                                No session logs loaded.
                              </p>
                            ) : (
                              <ul className="deckgo-shell-list deck-ui-usage-list">
                                {logs.map((log, index) => (
                                  <li key={`${entry.key}-${log.timestamp}-${index}`}>
                                    <div className="deckgo-selectable-card deck-ui-usage-row">
                                      <strong>{log.role || "message"}</strong>
                                      <div className="deckgo-meta deck-ui-usage-meta">
                                        {formatTimestamp(log.timestamp)} | {log.tokens ?? 0} tokens
                                        | {formatCurrency(log.cost ?? 0)}
                                      </div>
                                      <p className="deckgo-note">{log.content}</p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <p className="deckgo-surface-label">Usage timeseries</p>
                            {sessionLogsLoading && points.length === 0 ? (
                              <p className="deckgo-note deck-ui-usage-empty">
                                Loading usage timeseries...
                              </p>
                            ) : points.length === 0 ? (
                              <p className="deckgo-note deck-ui-usage-empty">
                                No usage timeseries loaded.
                              </p>
                            ) : (
                              <ul className="deckgo-shell-list deck-ui-usage-list">
                                {points.slice(0, 8).map((point, index) => (
                                  <li key={`${entry.key}-point-${point.timestamp}-${index}`}>
                                    <div className="deckgo-selectable-card deck-ui-usage-row">
                                      <strong>{formatTimestamp(point.timestamp)}</strong>
                                      <div className="deckgo-meta deck-ui-usage-meta">
                                        {point.totalTokens} tokens | {formatCurrency(point.cost)}
                                      </div>
                                      <div className="deckgo-meta deck-ui-usage-meta">
                                        cumulative {point.cumulativeTokens} tokens |{" "}
                                        {formatCurrency(point.cumulativeCost)}
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <p className="deckgo-surface-label">Context weight</p>
                            {sessionLogsLoading && !hasContextWeight ? (
                              <p className="deckgo-note deck-ui-usage-empty">
                                Loading context weight...
                              </p>
                            ) : !contextWeight || !contextSummary ? (
                              <p className="deckgo-note deck-ui-usage-empty">
                                No context weight data available.
                              </p>
                            ) : (
                              <>
                                <div className="deckgo-grid deckgo-grid-3 deck-ui-usage-stats">
                                  <ShellStat
                                    label="context total"
                                    value={formatChars(contextSummary.total)}
                                  />
                                  <ShellStat label="source" value={contextWeight.source} />
                                  <ShellStat
                                    label="generated"
                                    value={formatTimestamp(contextWeight.generatedAt)}
                                  />
                                </div>
                                <ul className="deckgo-shell-list deck-ui-usage-list">
                                  <li>
                                    <div className="deckgo-selectable-card deck-ui-usage-row">
                                      <strong>system prompt</strong>
                                      <div className="deckgo-meta deck-ui-usage-meta">
                                        {formatChars(contextSummary.system)} chars | project{" "}
                                        {formatChars(
                                          contextWeight.systemPrompt.projectContextChars,
                                        )}
                                      </div>
                                    </div>
                                  </li>
                                  <li>
                                    <div className="deckgo-selectable-card deck-ui-usage-row">
                                      <strong>tools</strong>
                                      <div className="deckgo-meta deck-ui-usage-meta">
                                        {formatChars(contextSummary.tools)} chars |{" "}
                                        {contextWeight.tools.entries.length} entries
                                      </div>
                                    </div>
                                  </li>
                                  <li>
                                    <div className="deckgo-selectable-card deck-ui-usage-row">
                                      <strong>skills</strong>
                                      <div className="deckgo-meta deck-ui-usage-meta">
                                        {formatChars(contextSummary.skills)} chars |{" "}
                                        {contextWeight.skills.entries.length} entries
                                      </div>
                                    </div>
                                  </li>
                                  <li>
                                    <div className="deckgo-selectable-card deck-ui-usage-row">
                                      <strong>files</strong>
                                      <div className="deckgo-meta deck-ui-usage-meta">
                                        {formatChars(contextSummary.files)} chars |{" "}
                                        {contextWeight.injectedWorkspaceFiles.length} files
                                      </div>
                                    </div>
                                  </li>
                                </ul>
                              </>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="deckgo-surface-tile deck-ui-usage-surface">
              <p className="deckgo-surface-label">Usage aggregates</p>
              {sessionAggregateRows.length === 0 ? (
                <p className="deckgo-note deck-ui-usage-empty">No usage aggregates loaded.</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-usage-list">
                  {sessionAggregateRows.map((entry) => (
                    <li key={`${entry.kind}-${entry.label}`}>
                      <div className="deckgo-selectable-card deck-ui-usage-row">
                        <strong>
                          {entry.kind}: {entry.label}
                        </strong>
                        <div className="deckgo-meta deck-ui-usage-meta">
                          {entry.totals.totalTokens ?? 0} tokens |{" "}
                          {formatCurrency(entry.totals.totalCost ?? 0)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="deckgo-surface-tile deck-ui-usage-surface">
              <p className="deckgo-surface-label">Usage behavior signals</p>
              {!usageSignals?.messages && !usageSignals?.tools && !usageSignals?.latency ? (
                <p className="deckgo-note deck-ui-usage-empty">No behavior signals loaded.</p>
              ) : (
                <>
                  <div className="deckgo-grid deckgo-grid-3 deck-ui-usage-stats">
                    <ShellStat label="messages" value={usageSignals.messages?.total ?? 0} />
                    <ShellStat label="tool calls" value={usageSignals.tools?.totalCalls ?? 0} />
                    <ShellStat
                      label="p95 latency"
                      value={formatDurationMs(usageSignals.latency?.p95Ms)}
                    />
                  </div>
                  {topTools.length > 0 ? (
                    <ul className="deckgo-shell-list deck-ui-usage-list">
                      {topTools.map((tool) => (
                        <li key={tool.name}>
                          <div className="deckgo-selectable-card deck-ui-usage-row">
                            <strong>{tool.name}</strong>
                            <div className="deckgo-meta deck-ui-usage-meta">{tool.count} calls</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {dailySignals.length > 0 ? (
                    <ul className="deckgo-shell-list deck-ui-usage-list">
                      {dailySignals.map((entry) => (
                        <li key={entry.date}>
                          <div className="deckgo-selectable-card deck-ui-usage-row">
                            <strong>{entry.date}</strong>
                            <div className="deckgo-meta deck-ui-usage-meta">
                              {entry.tokens} tokens | {formatCurrency(entry.cost)} |{" "}
                              {entry.messages} messages | {entry.toolCalls} tool calls
                            </div>
                            {entry.errors > 0 ? (
                              <div className="deckgo-meta deck-ui-usage-meta">
                                {entry.errors} errors
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-usage-column deck-ui-usage-detail-column">
        <article className="deckgo-card is-float deck-ui-usage-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Provider quotas</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Usage details stay anchored on cost, trend, session, context, and provider-pressure
            truth from the control plane.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-usage-body">
            {hottestWindow ? (
              <div className="deckgo-panel-hero-strip deck-ui-usage-hero">
                <div>
                  <p className="deckgo-kicker">Highest pressure window</p>
                  <strong>{hottestWindow.provider}</strong>
                  <p className="deckgo-note">{hottestWindow.window.label}</p>
                </div>
                <div className="deckgo-pill-row deck-ui-usage-status-row">
                  <span className="deckgo-pill">{hottestWindow.window.usedPercent}% used</span>
                  <span className="deckgo-pill">
                    resets in {formatReset(hottestWindow.window.resetAt)}
                  </span>
                </div>
              </div>
            ) : null}
            {providers.length === 0 ? (
              <p className="deckgo-note deck-ui-usage-empty">No provider usage loaded.</p>
            ) : (
              <>
                <ul className="deckgo-shell-list deck-ui-usage-list">
                  {providers.map((provider) => (
                    <li key={provider.provider}>
                      <button
                        type="button"
                        className={`deckgo-selectable-card deck-ui-usage-row ${selectedProvider?.provider === provider.provider ? "is-selected" : ""}`}
                        onClick={() => setSelectedProviderId(provider.provider)}
                      >
                        <strong>{provider.displayName || provider.provider}</strong>
                        <div className="deckgo-meta deck-ui-usage-meta">
                          plan: {provider.plan || "n/a"} | windows: {provider.windows.length}
                        </div>
                        {provider.error ? (
                          <div className="deckgo-meta deck-ui-usage-meta">{provider.error}</div>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                {selectedProvider ? (
                  <>
                    <div className="deckgo-grid deckgo-grid-2 deck-ui-usage-stats">
                      <ShellStat label="provider" value={selectedProvider.provider} />
                      <ShellStat label="windows" value={selectedProvider.windows.length} />
                    </div>
                    <ul className="deckgo-shell-list deck-ui-usage-list">
                      {selectedProvider.windows.map((window: DeckGoUsageProviderWindow) => (
                        <li key={`${selectedProvider.provider}-${window.label}`}>
                          <div className="deckgo-selectable-card deck-ui-usage-row">
                            <strong>{window.label}</strong>
                            <div className="deckgo-meta deck-ui-usage-meta">
                              {window.usedPercent}% used
                            </div>
                            <div className="deckgo-meta deck-ui-usage-meta">
                              resets in {formatReset(window.resetAt)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <JsonDetails title="Provider payload" payload={selectedProvider} />
                  </>
                ) : null}
              </>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
