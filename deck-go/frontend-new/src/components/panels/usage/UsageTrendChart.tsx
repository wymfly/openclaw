import { useMemo, useState } from "react";
import { useTranslations } from "../../../i18n/provider";
import type { UsageModelTrendRow, UsageTrendRow } from "./usage-trend";

type TrendView = "tokens" | "cost" | "byModel";

type UsageTrendChartProps = {
  dailyRows: UsageTrendRow[];
  modelRows: UsageModelTrendRow[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function metricValue(row: UsageTrendRow | UsageModelTrendRow, view: TrendView) {
  if (view === "cost") {
    return row.cost;
  }
  return row.tokens;
}

function metricLabel(
  row: UsageTrendRow | UsageModelTrendRow,
  view: TrendView,
  t: ReturnType<typeof useTranslations>,
) {
  if (view === "cost") {
    return formatCurrency(row.cost);
  }
  return t("tokensValue", { count: row.tokens });
}

export function UsageTrendChart({ dailyRows, modelRows }: UsageTrendChartProps) {
  const t = useTranslations("usage");
  const [view, setView] = useState<TrendView>("tokens");
  const activeView = view === "byModel" && modelRows.length === 0 ? "tokens" : view;
  const rows = activeView === "byModel" ? modelRows : dailyRows;
  const maxValue = useMemo(
    () => Math.max(1, ...rows.map((row) => metricValue(row, activeView))),
    [activeView, rows],
  );

  return (
    <div className="deckgo-surface-tile deck-ui-usage-surface deck-ui-usage-trend">
      <div className="deckgo-section-head deck-ui-usage-section-head">
        <p className="deckgo-surface-label">{t("usageTrend")}</p>
        <div className="deckgo-pill-row deck-ui-usage-actions">
          <button
            className={`deckgo-button deckgo-button-compact deck-ui-usage-button ${activeView === "tokens" ? "is-primary" : ""}`}
            type="button"
            onClick={() => setView("tokens")}
          >
            {t("chartTokensShort")}
          </button>
          <button
            className={`deckgo-button deckgo-button-compact deck-ui-usage-button ${activeView === "cost" ? "is-primary" : ""}`}
            type="button"
            onClick={() => setView("cost")}
          >
            {t("chartCostShort")}
          </button>
          {modelRows.length > 0 ? (
            <button
              className={`deckgo-button deckgo-button-compact deck-ui-usage-button ${activeView === "byModel" ? "is-primary" : ""}`}
              type="button"
              onClick={() => setView("byModel")}
            >
              {t("chartByModelShort")}
            </button>
          ) : null}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="deckgo-note deck-ui-usage-empty">{t("usageTrendEmpty")}</p>
      ) : (
        <div className="deckgo-usage-chart deck-ui-usage-chart" data-testid="usage-trend-chart">
          {rows.map((row) => {
            const value = metricValue(row, activeView);
            const width = Math.max(4, Math.round((value / maxValue) * 100));
            const label = "date" in row ? row.date : row.label || t("unknownModel");
            return (
              <div
                className="deckgo-usage-chart-row deck-ui-usage-chart-row"
                key={`${activeView}-${label}`}
              >
                <span className="deckgo-usage-chart-label">{label}</span>
                <span className="deckgo-usage-chart-track" aria-hidden="true">
                  <progress
                    className={`deckgo-usage-chart-bar deck-ui-usage-chart-bar ${activeView === "cost" ? "is-cost" : activeView === "byModel" ? "is-model" : ""}`}
                    max={100}
                    value={width}
                  />
                </span>
                <span className="deckgo-usage-chart-value">{metricLabel(row, activeView, t)}</span>
                {"date" in row && row.source === "sessions" ? (
                  <span className="deckgo-meta deckgo-usage-chart-detail">
                    {row.errors > 0
                      ? t("dailyChartDetailWithErrors", {
                          errors: row.errors,
                          messages: row.messages,
                          toolCalls: row.toolCalls,
                        })
                      : t("dailyChartDetail", {
                          messages: row.messages,
                          toolCalls: row.toolCalls,
                        })}
                  </span>
                ) : null}
                {"count" in row ? (
                  <span className="deckgo-meta deckgo-usage-chart-detail">
                    {t("modelChartDetail", {
                      cost: formatCurrency(row.cost),
                      count: row.count,
                    })}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
