import type {
  DeckGoUsageCostEntry,
  DeckGoUsageProviderStatus,
  DeckGoUsageSessionsResponse,
} from "../../../api";
import { KpiStrip, PanelMetric } from "../../../design-system/patterns";
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
    <KpiStrip
      aria-label={t("panel.metrics.window")}
      columns={6}
      data-testid="usage-summary-metrics"
    >
      <PanelMetric
        label={t("panel.metrics.window")}
        value={t("daysCount", { count: costEntries.length })}
        hint={t("providersCount", { count: providers.length })}
      />
      <PanelMetric
        label={t("totalCost")}
        value={formatCurrency(totalCost)}
        hint={t("panel.latestCost", { cost: formatCurrency(latestCost) })}
      />
      <PanelMetric
        label={t("totalTokens")}
        value={sessionsUsage?.totals?.totalTokens ?? 0}
        hint={`${t("tokensIn")} / ${t("tokensOut")}`}
      />
      <PanelMetric
        label={t("messages")}
        value={usageSignals?.messages?.total ?? 0}
        hint={t("callsValue", { count: usageSignals?.tools?.totalCalls ?? 0 })}
      />
      <PanelMetric
        label={t("latencyP95")}
        value={formatDurationMs(usageSignals?.latency?.p95Ms)}
        hint={`${t("avgLatency")}: ${formatDurationMs(usageSignals?.latency?.avgMs)}`}
      />
      <PanelMetric
        label={t("panel.metrics.pressure")}
        value={hottestWindow ? t("usedPercent", { percent: hottestWindow.usedPercent }) : t("na")}
        hint={hottestWindow?.label ?? t("noProviderUsage")}
      />
    </KpiStrip>
  );
}
