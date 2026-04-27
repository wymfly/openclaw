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
import { SessionUsageList } from "./SessionUsageList";
import { SummaryCards } from "./SummaryCards";
import {
  costEntryTotal,
  parseUsageDays,
  usageAggregateRows,
  usageRangeFromDays,
} from "./usage-format";
import { buildUsageModelTrendRows, buildUsageTrendRows } from "./usage-trend";
import { UsageTrendChart } from "./UsageTrendChart";

type PanelState = "idle" | "loading" | "ready";

export function UsagePanel() {
  const t = useTranslations("usage");
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

  const refreshUsageRange = useCallback(
    (nextDays: string) => {
      void refresh(selectedProviderId, nextDays);
    },
    [refresh, selectedProviderId],
  );

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
    <section className="deckgo-panel-workspace deck-ui-usage">
      <div className="deckgo-column deck-ui-usage-column">
        <article className="deckgo-card is-float deck-ui-usage-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("title")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("usageReadyDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-usage-body">
            <SummaryCards
              costEntries={costEntries}
              loadState={loadState}
              providers={providers}
              sessionsUsage={sessionsUsage}
              totalCost={totalCost}
            />
            <DateRangePicker days={days} onDaysChange={setDays} onRefresh={refreshUsageRange} />
            {error ? <p className="deckgo-note deck-ui-usage-error">{error}</p> : null}
            <UsageTrendChart dailyRows={trendRows} modelRows={modelTrendRows} />
            <SessionUsageList
              entries={sessionEntries}
              expandedSessionKey={expandedSessionKey}
              filteredEntries={filteredSessionEntries}
              loading={sessionLogsLoading}
              onOpenAgent={(agentId) => navigateToAgent(ui, agentId)}
              onOpenSession={(sessionKey) => navigateToSession(ui, sessionKey)}
              onSearchChange={setSessionSearch}
              onToggleSession={(entry) => void toggleSessionLogs(entry)}
              search={sessionSearch}
              sessionContextWeights={sessionContextWeights}
              sessionLogs={sessionLogs}
              sessionTimeseries={sessionTimeseries}
              totalSessionCost={totalSessionCost}
              totalSessionTokens={totalSessionTokens}
            />
            <BreakdownTable rows={sessionAggregateRows} />
            <LatencyCard
              dailySignals={dailySignals}
              sessionsUsage={sessionsUsage}
              topTools={topTools}
            />
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-usage-column deck-ui-usage-detail-column">
        <ProviderQuotaPanel
          hottestWindow={hottestWindow}
          providers={providers}
          selectedProvider={selectedProvider}
          onSelectProvider={setSelectedProviderId}
        />
      </div>
    </section>
  );
}
