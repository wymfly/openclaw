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
    <article className="usage-panel__card deck-ui-usage-surface">
      <div>
        <p className="usage-panel__label">{t("usageAggregates")}</p>
        <h3 className="usage-panel__card-title">{t("panel.aggregatesTitle")}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="usage-panel__empty deck-ui-usage-empty">{t("noUsageAggregates")}</p>
      ) : (
        <ul className="usage-panel__list deck-ui-usage-list">
          {rows.map((entry) => (
            <li key={`${entry.kind}-${entry.label}`}>
              <div className="usage-panel__row deck-ui-usage-row">
                <strong>
                  {kindLabel(entry.kind)}: {entry.label || fallbackLabel(entry.kind)}
                </strong>
                <div className="usage-panel__meta deck-ui-usage-meta">
                  {t("tokensValue", { count: entry.totals.totalTokens ?? 0 })} |{" "}
                  {formatCurrency(entry.totals.totalCost ?? 0)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
