import { useEffect, useState } from "react";
import type {
  DeckGoContextWeightReport,
  DeckGoUsageSessionEntry,
  DeckGoUsageSessionLogEntry,
  DeckGoUsageTimePoint,
} from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { ContextPressure } from "./ContextPressure";
import { formatCurrency, formatTimestamp, usageEntryCost, usageEntryTokens } from "./usage-format";

export type UsageSessionSort = "recent" | "cost" | "tokens";
type UsageDetailTab = "overview" | "timeseries" | "context" | "logs";

type SessionUsageListProps = {
  agentFilter: string;
  agentOptions: string[];
  channelFilter: string;
  channelOptions: string[];
  entries: DeckGoUsageSessionEntry[];
  expandedSessionKey: string;
  filteredEntries: DeckGoUsageSessionEntry[];
  loading: boolean;
  onAgentFilterChange: (value: string) => void;
  onChannelFilterChange: (value: string) => void;
  onOpenAgent: (agentId: string) => void;
  onOpenSession: (sessionKey: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: UsageSessionSort) => void;
  onToggleSession: (entry: DeckGoUsageSessionEntry) => void;
  search: string;
  sessionContextWeights: Record<string, DeckGoContextWeightReport | null>;
  sessionLogs: Record<string, DeckGoUsageSessionLogEntry[]>;
  sessionTimeseries: Record<string, DeckGoUsageTimePoint[]>;
  sort: UsageSessionSort;
  totalSessionCost: number;
  totalSessionTokens: number;
};

export function SessionUsageList({
  agentFilter,
  agentOptions,
  channelFilter,
  channelOptions,
  entries,
  expandedSessionKey,
  filteredEntries,
  loading,
  onAgentFilterChange,
  onChannelFilterChange,
  onOpenAgent,
  onOpenSession,
  onSearchChange,
  onSortChange,
  onToggleSession,
  search,
  sessionContextWeights,
  sessionLogs,
  sessionTimeseries,
  sort,
  totalSessionCost,
  totalSessionTokens,
}: SessionUsageListProps) {
  const t = useTranslations("usage");
  const [activeTab, setActiveTab] = useState<UsageDetailTab>("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [expandedSessionKey]);

  const detailTabs: Array<{ id: UsageDetailTab; label: string }> = [
    { id: "overview", label: t("detailOverview") },
    { id: "timeseries", label: t("detailTimeseries") },
    { id: "context", label: t("detailContext") },
    { id: "logs", label: t("detailLogs") },
  ];

  return (
    <article className="usage-panel__card usage-panel__sessions deck-ui-usage-surface">
      <div className="usage-panel__card-head">
        <div>
          <p className="usage-panel__label">{t("sessionUsageDrilldown")}</p>
          <h3 className="usage-panel__card-title">{t("panel.sessionsTitle")}</h3>
        </div>
        <div className="usage-panel__mini-metrics deck-ui-usage-stats">
          <span>
            {t("sessions")}: {entries.length}
          </span>
          <span>
            {t("tokens")}: {totalSessionTokens}
          </span>
          <span>
            {t("sessionCost")}: {formatCurrency(totalSessionCost)}
          </span>
        </div>
      </div>
      <div className="usage-panel__session-controls">
        <input
          aria-label={t("searchUsageSessions")}
          className="usage-panel__input deck-ui-usage-input"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("searchUsageSessions")}
          type="search"
        />
        <select
          aria-label={t("agentFilter")}
          className="usage-panel__input deck-ui-usage-input"
          value={agentFilter}
          onChange={(event) => onAgentFilterChange(event.target.value)}
        >
          <option value="">{t("allAgents")}</option>
          {agentOptions.map((agentId) => (
            <option key={agentId} value={agentId}>
              {agentId}
            </option>
          ))}
        </select>
        <select
          aria-label={t("channelFilter")}
          className="usage-panel__input deck-ui-usage-input"
          value={channelFilter}
          onChange={(event) => onChannelFilterChange(event.target.value)}
        >
          <option value="">{t("allChannels")}</option>
          {channelOptions.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
        <div
          className="usage-panel__segments deck-ui-usage-actions"
          role="tablist"
          aria-label={t("sortSessions")}
        >
          {[
            { id: "recent" as const, label: t("sortRecent") },
            { id: "cost" as const, label: t("sortCost") },
            { id: "tokens" as const, label: t("sortTokens") },
          ].map((option) => (
            <button
              aria-selected={sort === option.id}
              className={`usage-panel__button deck-ui-usage-button ${sort === option.id ? "is-primary" : ""}`}
              key={option.id}
              role="tab"
              type="button"
              onClick={() => onSortChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {filteredEntries.length === 0 ? (
        <p className="usage-panel__empty deck-ui-usage-empty">{t("noSessionUsageMatched")}</p>
      ) : (
        <ul className="usage-panel__list deck-ui-usage-list">
          {filteredEntries.map((entry) => {
            const logs = sessionLogs[entry.key] ?? [];
            const points = sessionTimeseries[entry.key] ?? [];
            const hasContextWeight = Object.hasOwn(sessionContextWeights, entry.key);
            const contextWeight = sessionContextWeights[entry.key] ?? null;
            const isExpanded = expandedSessionKey === entry.key;

            return (
              <li key={entry.key}>
                <button
                  type="button"
                  className={`usage-panel__row deck-ui-usage-row ${isExpanded ? "is-selected" : ""}`}
                  aria-pressed={isExpanded}
                  onClick={() => onToggleSession(entry)}
                >
                  <span className="usage-panel__row-head">
                    <strong>{entry.label || entry.key}</strong>
                    <span className="usage-panel__pill">
                      {t("tokensValue", { count: usageEntryTokens(entry) })}
                    </span>
                  </span>
                  <div className="usage-panel__meta deck-ui-usage-meta">
                    {entry.agentId || t("unknownAgent")} | {entry.channel || t("unknownChannel")} |{" "}
                    {t("updated", { value: formatTimestamp(entry.updatedAt) })}
                  </div>
                  <div className="usage-panel__pill-row deck-ui-usage-status-row">
                    <span className="usage-panel__pill">
                      {formatCurrency(usageEntryCost(entry))}
                    </span>
                  </div>
                </button>
                {isExpanded ? (
                  <div className="usage-panel__detail deck-ui-usage-surface deck-ui-usage-detail">
                    <div className="usage-panel__actions deck-ui-usage-actions">
                      {entry.agentId ? (
                        <button
                          className="usage-panel__button deck-ui-usage-button"
                          type="button"
                          onClick={() => onOpenAgent(entry.agentId ?? "")}
                        >
                          {t("openUsageAgent")}
                        </button>
                      ) : null}
                      <button
                        className="usage-panel__button deck-ui-usage-button"
                        type="button"
                        onClick={() => onOpenSession(entry.key)}
                      >
                        {t("openUsageSession")}
                      </button>
                    </div>
                    <div
                      className="usage-panel__detail-tabs"
                      role="tablist"
                      aria-label={t("sessionDetailTabs")}
                    >
                      {detailTabs.map((tab) => (
                        <button
                          aria-selected={activeTab === tab.id}
                          className={`usage-panel__button deck-ui-usage-button ${activeTab === tab.id ? "is-primary" : ""}`}
                          key={tab.id}
                          role="tab"
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    {activeTab === "overview" ? (
                      <>
                        <p className="usage-panel__label">{t("detailOverview")}</p>
                        <div className="usage-panel__mini-metrics deck-ui-usage-stats">
                          <span>
                            {t("tokensIn")}: {entry.usage?.input ?? t("na")}
                          </span>
                          <span>
                            {t("tokensOut")}: {entry.usage?.output ?? t("na")}
                          </span>
                          <span>
                            {t("totalTokens")}: {usageEntryTokens(entry)}
                          </span>
                          <span>
                            {t("cost")}: {formatCurrency(usageEntryCost(entry))}
                          </span>
                        </div>
                        <ul className="usage-panel__list deck-ui-usage-list">
                          <li>
                            <div className="usage-panel__row deck-ui-usage-row">
                              <strong>{entry.sessionId || entry.key}</strong>
                              <div className="usage-panel__meta deck-ui-usage-meta">
                                {entry.agentId || t("unknownAgent")} |{" "}
                                {entry.channel || t("unknownChannel")} |{" "}
                                {t("updated", { value: formatTimestamp(entry.updatedAt) })}
                              </div>
                              <div className="usage-panel__meta deck-ui-usage-meta">
                                {t("contextSource")}:{" "}
                                {contextWeight?.source ?? (loading ? t("loading") : t("na"))}
                              </div>
                            </div>
                          </li>
                        </ul>
                      </>
                    ) : null}
                    {activeTab === "timeseries" ? (
                      <>
                        <p className="usage-panel__label">{t("usageTimeseries")}</p>
                        {loading && points.length === 0 ? (
                          <p className="usage-panel__empty deck-ui-usage-empty">
                            {t("loadingUsageTimeseries")}
                          </p>
                        ) : points.length === 0 ? (
                          <p className="usage-panel__empty deck-ui-usage-empty">
                            {t("noUsageTimeseriesLoaded")}
                          </p>
                        ) : (
                          <ul className="usage-panel__list deck-ui-usage-list">
                            {points.slice(0, 8).map((point, index) => (
                              <li key={`${entry.key}-point-${point.timestamp}-${index}`}>
                                <div className="usage-panel__row deck-ui-usage-row">
                                  <strong>{formatTimestamp(point.timestamp)}</strong>
                                  <div className="usage-panel__meta deck-ui-usage-meta">
                                    {t("tokensValue", { count: point.totalTokens })} |{" "}
                                    {formatCurrency(point.cost)}
                                  </div>
                                  <div className="usage-panel__meta deck-ui-usage-meta">
                                    {t("cumulativeTokensCost", {
                                      cost: formatCurrency(point.cumulativeCost),
                                      tokens: point.cumulativeTokens,
                                    })}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : null}
                    {activeTab === "context" ? (
                      <ContextPressure
                        contextWeight={contextWeight}
                        hasContextWeight={hasContextWeight}
                        loading={loading}
                      />
                    ) : null}
                    {activeTab === "logs" ? (
                      <>
                        <p className="usage-panel__label">{t("sessionLogs")}</p>
                        {loading && logs.length === 0 ? (
                          <p className="usage-panel__empty deck-ui-usage-empty">
                            {t("loadingSessionLogs")}
                          </p>
                        ) : logs.length === 0 ? (
                          <p className="usage-panel__empty deck-ui-usage-empty">
                            {t("noSessionLogsLoaded")}
                          </p>
                        ) : (
                          <ul className="usage-panel__list deck-ui-usage-list">
                            {logs.map((log, index) => (
                              <li key={`${entry.key}-${log.timestamp}-${index}`}>
                                <div className="usage-panel__row deck-ui-usage-row">
                                  <strong>{log.role || t("message")}</strong>
                                  <div className="usage-panel__meta deck-ui-usage-meta">
                                    {formatTimestamp(log.timestamp)} |{" "}
                                    {t("tokensValue", { count: log.tokens ?? 0 })} |{" "}
                                    {formatCurrency(log.cost ?? 0)}
                                  </div>
                                  <p className="usage-panel__note">{log.content}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
