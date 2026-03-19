"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ModelBreakdown, AgentBreakdown } from "@/stores/usage";

interface BreakdownTableProps {
  modelBreakdown: ModelBreakdown[];
  agentBreakdown: AgentBreakdown[];
}

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-[var(--text-secondary)] text-sm">
        {message}
      </td>
    </tr>
  );
}

export function BreakdownTable({ modelBreakdown, agentBreakdown }: BreakdownTableProps) {
  const t = useTranslations("usage");

  const sortedModels = [...modelBreakdown].toSorted((a, b) => b.totalTokens - a.totalTokens);
  const sortedAgents = [...agentBreakdown].toSorted((a, b) => b.totalTokens - a.totalTokens);

  return (
    <div className="rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)] overflow-hidden">
      <Tabs defaultValue="model">
        <TabsList variant="line" className="w-full justify-start px-4 pt-3">
          <TabsTrigger value="model">{t("modelBreakdown")}</TabsTrigger>
          <TabsTrigger value="agent">{t("agentBreakdown")}</TabsTrigger>
        </TabsList>

        <TabsContent value="model">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]">
                    Name
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]">
                    {t("tokensIn")}
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]">
                    {t("tokensOut")}
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]">
                    {t("totalCost")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedModels.length === 0 ? (
                  <EmptyRow colSpan={4} message={t("noData")} />
                ) : (
                  sortedModels.map((row) => (
                    <tr
                      key={row.model}
                      className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-tertiary)] transition-colors duration-150"
                    >
                      <td className="px-4 py-2.5 text-[var(--text-primary)] font-medium">
                        {row.model}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                        {row.tokensIn.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                        {row.tokensOut.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                        {formatCost(row.cost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="agent">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]">
                    Name
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]">
                    {t("tokensIn")}
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]">
                    {t("tokensOut")}
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]">
                    {t("totalCost")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAgents.length === 0 ? (
                  <EmptyRow colSpan={4} message={t("noData")} />
                ) : (
                  sortedAgents.map((row) => (
                    <tr
                      key={row.agentId}
                      className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-tertiary)] transition-colors duration-150"
                    >
                      <td className="px-4 py-2.5 text-[var(--text-primary)] font-medium">
                        {row.agentName || row.agentId}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                        {row.tokensIn.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                        {row.tokensOut.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                        {formatCost(row.cost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
