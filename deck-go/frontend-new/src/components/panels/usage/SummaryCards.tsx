import type {
  DeckGoUsageCostEntry,
  DeckGoUsageProviderStatus,
  DeckGoUsageSessionsResponse,
} from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { ShellStat } from "../../shared/ShellComponents";
import { formatCurrency, formatDurationMs } from "./usage-format";

type SummaryCardsProps = {
  costEntries: DeckGoUsageCostEntry[];
  loadState: "idle" | "loading" | "ready";
  providers: DeckGoUsageProviderStatus[];
  sessionsUsage: DeckGoUsageSessionsResponse | null;
  totalCost: number;
};

export function SummaryCards({
  costEntries,
  loadState,
  providers,
  sessionsUsage,
  totalCost,
}: SummaryCardsProps) {
  const t = useTranslations("usage");
  const usageSignals = sessionsUsage?.aggregates ?? null;

  return (
    <>
      <div className="deckgo-pill-row deck-ui-usage-status-row">
        <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
          {t("status", { state: t(loadState) })}
        </span>
        <span className="deckgo-pill">{t("daysCount", { count: costEntries.length })}</span>
        <span className="deckgo-pill">{t("providersCount", { count: providers.length })}</span>
      </div>
      <div className="deckgo-grid deckgo-grid-3 deck-ui-usage-stats">
        <ShellStat label={t("days")} value={costEntries.length} />
        <ShellStat label={t("providers")} value={providers.length} />
        <ShellStat label={t("totalCostLower")} value={formatCurrency(totalCost)} />
        <ShellStat label={t("totalTokens")} value={sessionsUsage?.totals?.totalTokens ?? 0} />
        <ShellStat label={t("messages")} value={usageSignals?.messages?.total ?? 0} />
        <ShellStat label={t("latencyP95")} value={formatDurationMs(usageSignals?.latency?.p95Ms)} />
      </div>
    </>
  );
}
