import type {
  DeckGoContextWeightReport,
  DeckGoUsageSessionEntry,
  DeckGoUsageSessionLogEntry,
  DeckGoUsageTimePoint,
} from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { ContextPressure } from "./ContextPressure";
import { formatCurrency, formatTimestamp, usageEntryCost, usageEntryTokens } from "./usage-format";

type SessionUsageListProps = {
  entries: DeckGoUsageSessionEntry[];
  expandedSessionKey: string;
  filteredEntries: DeckGoUsageSessionEntry[];
  loading: boolean;
  onOpenAgent: (agentId: string) => void;
  onOpenSession: (sessionKey: string) => void;
  onSearchChange: (value: string) => void;
  onToggleSession: (entry: DeckGoUsageSessionEntry) => void;
  search: string;
  sessionContextWeights: Record<string, DeckGoContextWeightReport | null>;
  sessionLogs: Record<string, DeckGoUsageSessionLogEntry[]>;
  sessionTimeseries: Record<string, DeckGoUsageTimePoint[]>;
  totalSessionCost: number;
  totalSessionTokens: number;
};

export function SessionUsageList({
  entries,
  expandedSessionKey,
  filteredEntries,
  loading,
  onOpenAgent,
  onOpenSession,
  onSearchChange,
  onToggleSession,
  search,
  sessionContextWeights,
  sessionLogs,
  sessionTimeseries,
  totalSessionCost,
  totalSessionTokens,
}: SessionUsageListProps) {
  const t = useTranslations("usage");

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
      <input
        aria-label={t("searchUsageSessions")}
        className="usage-panel__input deck-ui-usage-input"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t("searchUsageSessions")}
      />
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
                    <p className="usage-panel__label">{t("sessionLogs")}</p>
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
                    <ContextPressure
                      contextWeight={contextWeight}
                      hasContextWeight={hasContextWeight}
                      loading={loading}
                    />
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
