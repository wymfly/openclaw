import { useTranslations } from "../../../i18n/provider";
import type { UsageAggregateRow } from "./usage-format";
import { formatCurrency } from "./usage-format";

type BreakdownTableProps = {
  rows: UsageAggregateRow[];
};

export function BreakdownTable({ rows }: BreakdownTableProps) {
  const t = useTranslations("usage");
  const kindLabel = (kind: UsageAggregateRow["kind"]) =>
    t(`kind${kind[0].toUpperCase()}${kind.slice(1)}`);
  const fallbackLabel = (kind: UsageAggregateRow["kind"]) =>
    t(`unknown${kind[0].toUpperCase()}${kind.slice(1)}`);

  return (
    <div className="deckgo-surface-tile deck-ui-usage-surface">
      <p className="deckgo-surface-label">{t("usageAggregates")}</p>
      {rows.length === 0 ? (
        <p className="deckgo-note deck-ui-usage-empty">{t("noUsageAggregates")}</p>
      ) : (
        <ul className="deckgo-shell-list deck-ui-usage-list">
          {rows.map((entry) => (
            <li key={`${entry.kind}-${entry.label}`}>
              <div className="deckgo-selectable-card deck-ui-usage-row">
                <strong>
                  {kindLabel(entry.kind)}: {entry.label || fallbackLabel(entry.kind)}
                </strong>
                <div className="deckgo-meta deck-ui-usage-meta">
                  {t("tokensValue", { count: entry.totals.totalTokens ?? 0 })} |{" "}
                  {formatCurrency(entry.totals.totalCost ?? 0)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
