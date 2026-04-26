import { useMemo, useState } from "react";
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

function metricLabel(row: UsageTrendRow | UsageModelTrendRow, view: TrendView) {
  if (view === "cost") {
    return formatCurrency(row.cost);
  }
  return `${row.tokens} tokens`;
}

export function UsageTrendChart({ dailyRows, modelRows }: UsageTrendChartProps) {
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
        <p className="deckgo-surface-label">Usage trend</p>
        <div className="deckgo-pill-row deck-ui-usage-actions">
          <button
            className={`deckgo-button deckgo-button-compact deck-ui-usage-button ${activeView === "tokens" ? "is-primary" : ""}`}
            type="button"
            onClick={() => setView("tokens")}
          >
            Tokens
          </button>
          <button
            className={`deckgo-button deckgo-button-compact deck-ui-usage-button ${activeView === "cost" ? "is-primary" : ""}`}
            type="button"
            onClick={() => setView("cost")}
          >
            Cost
          </button>
          {modelRows.length > 0 ? (
            <button
              className={`deckgo-button deckgo-button-compact deck-ui-usage-button ${activeView === "byModel" ? "is-primary" : ""}`}
              type="button"
              onClick={() => setView("byModel")}
            >
              By model
            </button>
          ) : null}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="deckgo-note deck-ui-usage-empty">No usage trend loaded.</p>
      ) : (
        <div className="deckgo-usage-chart deck-ui-usage-chart" data-testid="usage-trend-chart">
          {rows.map((row) => {
            const value = metricValue(row, activeView);
            const width = Math.max(4, Math.round((value / maxValue) * 100));
            const label = "date" in row ? row.date : row.label;
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
                <span className="deckgo-usage-chart-value">{metricLabel(row, activeView)}</span>
                {"date" in row && row.source === "sessions" ? (
                  <span className="deckgo-meta deckgo-usage-chart-detail">
                    {row.messages} messages | {row.toolCalls} tool calls
                    {row.errors > 0 ? ` | ${row.errors} errors` : ""}
                  </span>
                ) : null}
                {"count" in row ? (
                  <span className="deckgo-meta deckgo-usage-chart-detail">
                    {row.count} runs | {formatCurrency(row.cost)}
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
