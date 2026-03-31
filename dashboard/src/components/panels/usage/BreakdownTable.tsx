"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { SortableHeader, useListState } from "@/components/lists";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { CostUsageTotals, SessionsUsageAggregates } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Dimension = "model" | "provider" | "agent" | "channel";

interface BreakdownRow {
  id: string;
  name: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  proportion: number;
}

interface BreakdownTableProps {
  aggregates: SessionsUsageAggregates | null;
  totals: CostUsageTotals | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function buildRows(
  aggregates: SessionsUsageAggregates,
  dimension: Dimension,
  totalCost: number,
): BreakdownRow[] {
  const makeProportion = (cost: number) =>
    totalCost > 0 ? (cost / totalCost) * 100 : 0;

  switch (dimension) {
    case "model":
      return aggregates.byModel.map((m, i) => ({
        id: `model-${i}`,
        name: m.model ?? m.provider ?? "unknown",
        tokensIn: m.totals.input,
        tokensOut: m.totals.output,
        cost: m.totals.totalCost,
        proportion: makeProportion(m.totals.totalCost),
      }));
    case "provider":
      return aggregates.byProvider.map((p, i) => ({
        id: `provider-${i}`,
        name: p.provider ?? "unknown",
        tokensIn: p.totals.input,
        tokensOut: p.totals.output,
        cost: p.totals.totalCost,
        proportion: makeProportion(p.totals.totalCost),
      }));
    case "agent":
      return aggregates.byAgent.map((a) => ({
        id: `agent-${a.agentId}`,
        name: a.agentId,
        tokensIn: a.totals.input,
        tokensOut: a.totals.output,
        cost: a.totals.totalCost,
        proportion: makeProportion(a.totals.totalCost),
      }));
    case "channel":
      return aggregates.byChannel.map((c) => ({
        id: `channel-${c.channel}`,
        name: c.channel,
        tokensIn: c.totals.input,
        tokensOut: c.totals.output,
        cost: c.totals.totalCost,
        proportion: makeProportion(c.totals.totalCost),
      }));
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BreakdownTable({ aggregates, totals }: BreakdownTableProps) {
  const t = useTranslations("usage");
  const [dimension, setDimension] = useState<Dimension>("model");

  const rows = useMemo(() => {
    if (!aggregates || !totals) return [];
    return buildRows(aggregates, dimension, totals.totalCost);
  }, [aggregates, totals, dimension]);

  const { paginatedData, sort, setSort, page, totalPages, setPage } =
    useListState<BreakdownRow>({
      data: rows,
      pageSize: 20,
    });

  // Reset page when dimension changes
  const handleDimensionChange = (d: Dimension) => {
    setDimension(d);
    setPage(1);
    setSort({ key: "cost", direction: "desc" });
  };

  const tabs: { key: Dimension; label: string }[] = [
    { key: "model", label: t("modelBreakdown") },
    { key: "provider", label: t("providerBreakdown") },
    { key: "agent", label: t("agentBreakdown") },
    { key: "channel", label: t("channelBreakdown") },
  ];

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Tab bar */}
      <div className="flex gap-0 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color:
                dimension === tab.key
                  ? "var(--primary)"
                  : "var(--muted-foreground)",
              borderBottom:
                dimension === tab.key
                  ? "2px solid var(--primary)"
                  : "2px solid transparent",
              backgroundColor: "transparent",
            }}
            onClick={() => handleDimensionChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th
                className="text-left px-4 py-2 font-medium border-b"
                style={{
                  color: "var(--muted-foreground)",
                  borderColor: "var(--border)",
                }}
              >
                {tabs.find((tab) => tab.key === dimension)?.label ?? dimension}
              </th>
              <th
                className="text-right px-4 py-2 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <SortableHeader
                  columnKey="tokensIn"
                  sort={sort}
                  onSortChange={setSort}
                >
                  {t("tokensIn")}
                </SortableHeader>
              </th>
              <th
                className="text-right px-4 py-2 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <SortableHeader
                  columnKey="tokensOut"
                  sort={sort}
                  onSortChange={setSort}
                >
                  {t("tokensOut")}
                </SortableHeader>
              </th>
              <th
                className="text-right px-4 py-2 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <SortableHeader
                  columnKey="cost"
                  sort={sort}
                  onSortChange={setSort}
                >
                  {t("totalCost")}
                </SortableHeader>
              </th>
              <th
                className="text-right px-4 py-2 font-medium border-b"
                style={{
                  color: "var(--muted-foreground)",
                  borderColor: "var(--border)",
                }}
              >
                {t("proportion")}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {t("noData")}
                </td>
              </tr>
            )}
            {paginatedData.map((row: BreakdownRow) => (
              <tr
                key={row.id}
                className="border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-4 py-2" style={{ color: "var(--foreground)" }}>
                  {row.name}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={{ color: "var(--foreground)" }}
                >
                  {row.tokensIn.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={{ color: "var(--foreground)" }}
                >
                  {row.tokensOut.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={{ color: "var(--foreground)" }}
                >
                  {formatCost(row.cost)}
                </td>
                <td
                  className="px-4 py-2 text-right"
                  style={{ color: "var(--foreground)" }}
                >
                  <div className="flex items-center justify-end gap-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.max(2, row.proportion)}%`,
                        maxWidth: "60px",
                        backgroundColor: "var(--primary)",
                        opacity: 0.6,
                      }}
                    />
                    <span
                      className="text-xs tabular-nums"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {row.proportion.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-2 border-t" style={{ borderColor: "var(--border)" }}>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(Math.max(1, page - 1))}
                  aria-disabled={page <= 1}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === page}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  aria-disabled={page >= totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
