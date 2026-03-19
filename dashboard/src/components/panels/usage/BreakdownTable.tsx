"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ModelBreakdown, AgentBreakdown } from "@/stores/usage";

interface BreakdownTableProps {
  modelBreakdown: ModelBreakdown[];
  agentBreakdown: AgentBreakdown[];
}

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function BreakdownTable({ modelBreakdown, agentBreakdown }: BreakdownTableProps) {
  const t = useTranslations("usage");

  const sortedModels = [...modelBreakdown].toSorted((a, b) => b.totalTokens - a.totalTokens);
  const sortedAgents = [...agentBreakdown].toSorted((a, b) => b.totalTokens - a.totalTokens);

  return (
    <Card size="sm" className="overflow-hidden">
      <Tabs defaultValue="model">
        <TabsList variant="line" className="w-full justify-start px-4 pt-2">
          <TabsTrigger value="model">{t("modelBreakdown")}</TabsTrigger>
          <TabsTrigger value="agent">{t("agentBreakdown")}</TabsTrigger>
        </TabsList>

        <TabsContent value="model">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    {t("tokensIn")}
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    {t("tokensOut")}
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    {t("totalCost")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedModels.map((row) => (
                  <tr key={row.model} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 text-foreground">{row.model}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {row.tokensIn.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {row.tokensOut.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {formatCost(row.cost)}
                    </td>
                  </tr>
                ))}
                {sortedModels.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      {t("noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="agent">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    {t("tokensIn")}
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    {t("tokensOut")}
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    {t("totalCost")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAgents.map((row) => (
                  <tr key={row.agentId} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 text-foreground">{row.agentName || row.agentId}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {row.tokensIn.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {row.tokensOut.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {formatCost(row.cost)}
                    </td>
                  </tr>
                ))}
                {sortedAgents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      {t("noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
