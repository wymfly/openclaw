"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ModelBreakdown, AgentBreakdown } from "@/stores/usage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "model" | "agent";

interface BreakdownTableProps {
  modelBreakdown: ModelBreakdown[];
  agentBreakdown: AgentBreakdown[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Shared table styles
// ---------------------------------------------------------------------------

const headerCellStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "var(--border)",
};

const cellStyle: React.CSSProperties = {
  color: "var(--text-primary)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BreakdownTable({ modelBreakdown, agentBreakdown }: BreakdownTableProps) {
  const t = useTranslations("usage");
  const [tab, setTab] = useState<Tab>("model");

  // Sort by totalTokens descending.
  const sortedModels = [...modelBreakdown].toSorted((a, b) => b.totalTokens - a.totalTokens);
  const sortedAgents = [...agentBreakdown].toSorted((a, b) => b.totalTokens - a.totalTokens);

  const tabs: { key: Tab; label: string }[] = [
    { key: "model", label: t("modelBreakdown") },
    { key: "agent", label: t("agentBreakdown") },
  ];

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Tab bar */}
      <div className="flex gap-0 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color: tab === item.key ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: tab === item.key ? "2px solid var(--accent)" : "2px solid transparent",
              backgroundColor: "transparent",
            }}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-4 py-2 font-medium" style={headerCellStyle}>
                Name
              </th>
              <th className="text-right px-4 py-2 font-medium" style={headerCellStyle}>
                {t("tokensIn")}
              </th>
              <th className="text-right px-4 py-2 font-medium" style={headerCellStyle}>
                {t("tokensOut")}
              </th>
              <th className="text-right px-4 py-2 font-medium" style={headerCellStyle}>
                {t("totalCost")}
              </th>
            </tr>
          </thead>
          <tbody>
            {tab === "model" &&
              sortedModels.map((row) => (
                <tr
                  key={row.model}
                  className="border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-4 py-2" style={cellStyle}>
                    {row.model}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" style={cellStyle}>
                    {row.tokensIn.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" style={cellStyle}>
                    {row.tokensOut.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" style={cellStyle}>
                    {formatCost(row.cost)}
                  </td>
                </tr>
              ))}
            {tab === "agent" &&
              sortedAgents.map((row) => (
                <tr
                  key={row.agentId}
                  className="border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-4 py-2" style={cellStyle}>
                    {row.agentName || row.agentId}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" style={cellStyle}>
                    {row.tokensIn.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" style={cellStyle}>
                    {row.tokensOut.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" style={cellStyle}>
                    {formatCost(row.cost)}
                  </td>
                </tr>
              ))}
            {tab === "model" && sortedModels.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("noData")}
                </td>
              </tr>
            )}
            {tab === "agent" && sortedAgents.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
