import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DeckGoContextWeightReport,
  DeckGoUsageCostEntry,
  DeckGoUsageProviderStatus,
  DeckGoUsageSessionEntry,
  DeckGoUsageSessionLogEntry,
  DeckGoUsageSessionsResponse,
  DeckGoUsageTimePoint,
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
import { useTranslations } from "../../../i18n/provider";
import { BreakdownTable } from "./BreakdownTable";
import { DateRangePicker } from "./DateRangePicker";
import { LatencyCard } from "./LatencyCard";
import { ProviderQuotaPanel } from "./ProviderQuotaPanel";
import { SessionUsageList, type UsageSessionSort } from "./SessionUsageList";
import { SummaryCards } from "./SummaryCards";
import {
  costEntryTotal,
  parseUsageDays,
  usageAggregateRows,
  usageRangeFromDays,
} from "./usage-format";
import { buildUsageModelTrendRows, buildUsageTrendRows } from "./usage-trend";
import { UsageTrendChart } from "./UsageTrendChart";
import "./usage-panel.css";

type PanelState = "idle" | "loading" | "ready";

export function UsagePanel() {
  const t = useTranslations("usage");
  const ui = useDeckUI();
  const [days, setDays] = useState("14");
  const [costEntries, setCostEntries] = useState<DeckGoUsageCostEntry[]>([]);
  const [providers, setProviders] = useState<DeckGoUsageProviderStatus[]>([]);
  const [sessionsUsage, setSessionsUsage] = useState<DeckGoUsageSessionsResponse | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [sessionSort, setSessionSort] = useState<UsageSessionSort>("recent");
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
        setError(loadError instanceof Error ? loadError.message : t("failedLoadUsage"));
      }
    },
    [days, t],
  );

  useEffect(() => {
    if (didInitialRefresh.current) {
      return;
    }
    didInitialRefresh.current = true;
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".usage-panel input[type='search']")?.focus();
        return;
      }
      if (event.key === "Escape" && expandedSessionKey) {
        setExpandedSessionKey("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedSessionKey]);

  const refreshUsageRange = useCallback(
    (nextDays: string) => {
      void refresh(selectedProviderId, nextDays);
    },
    [refresh, selectedProviderId],
  );

  const sessionEntries = useMemo(() => sessionsUsage?.sessions ?? [], [sessionsUsage]);
  const agentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sessionEntries
            .map((entry) => entry.agentId)
            .filter((value): value is string => Boolean(value)),
        ),
      ).toSorted(),
    [sessionEntries],
  );
  const channelOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sessionEntries
            .map((entry) => entry.channel)
            .filter((value): value is string => Boolean(value)),
        ),
      ).toSorted(),
    [sessionEntries],
  );
  const filteredSessionEntries = useMemo(() => {
    const needle = sessionSearch.trim().toLowerCase();
    return sessionEntries
      .filter((entry) =>
        needle
          ? [entry.key, entry.label, entry.sessionId, entry.agentId, entry.channel].some((value) =>
              value?.toLowerCase().includes(needle),
            )
          : true,
      )
      .filter((entry) => (agentFilter ? entry.agentId === agentFilter : true))
      .filter((entry) => (channelFilter ? entry.channel === channelFilter : true))
      .toSorted((left, right) => {
        if (sessionSort === "cost") {
          return (right.usage?.totalCost ?? 0) - (left.usage?.totalCost ?? 0);
        }
        if (sessionSort === "tokens") {
          return (right.usage?.totalTokens ?? 0) - (left.usage?.totalTokens ?? 0);
        }
        return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
      });
  }, [agentFilter, channelFilter, sessionEntries, sessionSearch, sessionSort]);
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
    () => costEntries.reduce((sum, entry) => sum + costEntryTotal(entry), 0),
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
        setError(loadError instanceof Error ? loadError.message : t("failedLoadSessionDetail"));
      } finally {
        setSessionLogsLoading(false);
      }
    },
    [expandedSessionKey, sessionContextWeights, sessionLogs, sessionTimeseries, t],
  );

  return (
    <section className="usage-panel deck-ui-usage" data-testid="usage-panel">
      <header className="usage-panel__header">
        <div className="usage-panel__title-stack">
          <p className="usage-panel__eyebrow">{t("panel.eyebrow")}</p>
          <h2 className="usage-panel__title">{t("panel.workbenchTitle")}</h2>
          <p className="usage-panel__description">{t("panel.workbenchDescription")}</p>
        </div>
        <div className="usage-panel__header-actions">
          <span className={`usage-panel__pill ${loadState === "ready" ? "is-positive" : ""}`}>
            {t("status", { state: t(loadState) })}
          </span>
          <span className={`usage-panel__pill ${ui.bootstrap?.ok ? "is-positive" : ""}`}>
            {ui.bootstrap?.ok ? t("bootstrapReady") : t("bootstrapUnavailable")}
          </span>
          <span className="usage-panel__pill">
            {t("daysCount", { count: parseUsageDays(days) ?? 14 })}
          </span>
          <button
            className="usage-panel__button is-primary"
            type="button"
            onClick={() => refreshUsageRange(days)}
          >
            {t("refresh")}
          </button>
        </div>
      </header>

      {error ? (
        <div className="usage-panel__banner deck-ui-usage-error" role="status">
          {error}
        </div>
      ) : null}

      <SummaryCards
        costEntries={costEntries}
        providers={providers}
        sessionsUsage={sessionsUsage}
        totalCost={totalCost}
      />

      <section className="usage-panel__workbench">
        <div className="usage-panel__main">
          <DateRangePicker days={days} onDaysChange={setDays} onRefresh={refreshUsageRange} />
          <UsageTrendChart dailyRows={trendRows} modelRows={modelTrendRows} />
          <SessionUsageList
            agentFilter={agentFilter}
            agentOptions={agentOptions}
            channelFilter={channelFilter}
            channelOptions={channelOptions}
            entries={sessionEntries}
            expandedSessionKey={expandedSessionKey}
            filteredEntries={filteredSessionEntries}
            loading={sessionLogsLoading}
            onAgentFilterChange={setAgentFilter}
            onChannelFilterChange={setChannelFilter}
            onOpenAgent={(agentId) => navigateToAgent(ui, agentId)}
            onOpenSession={(sessionKey) => navigateToSession(ui, sessionKey)}
            onSearchChange={setSessionSearch}
            onSortChange={setSessionSort}
            onToggleSession={(entry) => void toggleSessionLogs(entry)}
            search={sessionSearch}
            sessionContextWeights={sessionContextWeights}
            sessionLogs={sessionLogs}
            sessionTimeseries={sessionTimeseries}
            sort={sessionSort}
            totalSessionCost={totalSessionCost}
            totalSessionTokens={totalSessionTokens}
          />
          <div className="usage-panel__evidence-grid">
            <BreakdownTable rows={sessionAggregateRows} />
            <LatencyCard
              dailySignals={dailySignals}
              sessionsUsage={sessionsUsage}
              topTools={topTools}
            />
          </div>
        </div>

        <aside className="usage-panel__sidecar">
          <ProviderQuotaPanel
            hottestWindow={hottestWindow}
            providers={providers}
            selectedProvider={selectedProvider}
            onSelectProvider={setSelectedProviderId}
          />
        </aside>
      </section>
    </section>
  );
}
