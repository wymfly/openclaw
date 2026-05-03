import type {
  DeckGoUsageCostEntry,
  DeckGoUsageProviderStatus,
  DeckGoUsageSessionsResponse,
} from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { costEntryTotal, formatCurrency, formatDurationMs } from "./usage-format";

type SummaryCardsProps = {
  costEntries: DeckGoUsageCostEntry[];
  providers: DeckGoUsageProviderStatus[];
  sessionsUsage: DeckGoUsageSessionsResponse | null;
  totalCost: number;
};

export function SummaryCards({
  costEntries,
  providers,
  sessionsUsage,
  totalCost,
}: SummaryCardsProps) {
  const t = useTranslations("usage");
  const usageSignals = sessionsUsage?.aggregates ?? null;
  const latestCost = costEntryTotal(costEntries.at(-1) ?? { date: "", totalCost: 0 });
  const hottestWindow =
    providers
      .flatMap((provider) =>
        provider.windows.map((window) => ({
          label: `${provider.displayName || provider.provider} ${window.label}`,
          usedPercent: window.usedPercent,
        })),
      )
      .toSorted((left, right) => right.usedPercent - left.usedPercent)[0] ?? null;

  return (
    <div className="usage-panel__metrics deck-ui-usage-stats" data-testid="usage-summary-metrics">
      <div className="usage-panel__metric">
        <span>{t("panel.metrics.window")}</span>
        <strong>{t("daysCount", { count: costEntries.length })}</strong>
        <small>{t("providersCount", { count: providers.length })}</small>
      </div>
      <div className="usage-panel__metric">
        <span>{t("totalCost")}</span>
        <strong>{formatCurrency(totalCost)}</strong>
        <small>{t("panel.latestCost", { cost: formatCurrency(latestCost) })}</small>
      </div>
      <div className="usage-panel__metric">
        <span>{t("totalTokens")}</span>
        <strong>{sessionsUsage?.totals?.totalTokens ?? 0}</strong>
        <small>
          {t("tokensIn")} / {t("tokensOut")}
        </small>
      </div>
      <div className="usage-panel__metric">
        <span>{t("messages")}</span>
        <strong>{usageSignals?.messages?.total ?? 0}</strong>
        <small>{t("callsValue", { count: usageSignals?.tools?.totalCalls ?? 0 })}</small>
      </div>
      <div className="usage-panel__metric">
        <span>{t("latencyP95")}</span>
        <strong>{formatDurationMs(usageSignals?.latency?.p95Ms)}</strong>
        <small>
          {t("avgLatency")}: {formatDurationMs(usageSignals?.latency?.avgMs)}
        </small>
      </div>
      <div className="usage-panel__metric">
        <span>{t("panel.metrics.pressure")}</span>
        <strong>
          {hottestWindow ? t("usedPercent", { percent: hottestWindow.usedPercent }) : t("na")}
        </strong>
        <small>{hottestWindow?.label ?? t("noProviderUsage")}</small>
      </div>
    </div>
  );
}
