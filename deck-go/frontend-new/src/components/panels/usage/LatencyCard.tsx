import type { DeckGoUsageDailyAggregate, DeckGoUsageSessionsResponse } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { ShellStat } from "../../shared/ShellComponents";
import { formatCurrency, formatDurationMs } from "./usage-format";

type LatencyCardProps = {
  dailySignals: DeckGoUsageDailyAggregate[];
  sessionsUsage: DeckGoUsageSessionsResponse | null;
  topTools: Array<{ count: number; name: string }>;
};

export function LatencyCard({ dailySignals, sessionsUsage, topTools }: LatencyCardProps) {
  const t = useTranslations("usage");
  const usageSignals = sessionsUsage?.aggregates ?? null;

  return (
    <article className="usage-panel__card deck-ui-usage-surface">
      <div>
        <p className="usage-panel__label">{t("usageBehaviorSignals")}</p>
        <h3 className="usage-panel__card-title">{t("panel.behaviorTitle")}</h3>
      </div>
      {!usageSignals?.messages && !usageSignals?.tools && !usageSignals?.latency ? (
        <p className="usage-panel__empty deck-ui-usage-empty">{t("noBehaviorSignals")}</p>
      ) : (
        <>
          <div className="usage-panel__mini-metrics deck-ui-usage-stats">
            <ShellStat label={t("messages")} value={usageSignals.messages?.total ?? 0} />
            <ShellStat label={t("toolCallsLower")} value={usageSignals.tools?.totalCalls ?? 0} />
            <ShellStat
              label={t("latencyP95")}
              value={formatDurationMs(usageSignals.latency?.p95Ms)}
            />
          </div>
          {topTools.length > 0 ? (
            <ul className="usage-panel__list deck-ui-usage-list">
              {topTools.map((tool) => (
                <li key={tool.name}>
                  <div className="usage-panel__row deck-ui-usage-row">
                    <strong>{tool.name}</strong>
                    <div className="usage-panel__meta deck-ui-usage-meta">
                      {t("callsValue", { count: tool.count })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {dailySignals.length > 0 ? (
            <ul className="usage-panel__list deck-ui-usage-list">
              {dailySignals.map((entry) => (
                <li key={entry.date}>
                  <div className="usage-panel__row deck-ui-usage-row">
                    <strong>{entry.date}</strong>
                    <div className="usage-panel__meta deck-ui-usage-meta">
                      {t("dailySignal", {
                        cost: formatCurrency(entry.cost),
                        messages: entry.messages,
                        tokens: entry.tokens,
                        toolCalls: entry.toolCalls,
                      })}
                    </div>
                    {entry.errors > 0 ? (
                      <div className="usage-panel__meta deck-ui-usage-meta">
                        {t("errorsValue", { count: entry.errors })}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </article>
  );
}
