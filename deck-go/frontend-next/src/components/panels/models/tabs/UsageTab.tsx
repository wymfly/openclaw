"use client";

import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModelsStore } from "@/stores/models";
import { CostTrendChart } from "../usage/CostTrendChart";
import { ProviderQuotaGrid } from "../usage/ProviderQuotaGrid";
import { SummaryCards } from "../usage/SummaryCards";

export function UsageTab() {
  const { authOverview, usageCost, usageProviders, fetchUsageSummary, fetchAuthOverview } =
    useModelsStore();

  useEffect(() => {
    void fetchUsageSummary();
    void fetchAuthOverview();
  }, [fetchUsageSummary, fetchAuthOverview]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <SummaryCards cost={usageCost} auth={authOverview} />
        <ProviderQuotaGrid providers={usageProviders} />
        <CostTrendChart data={usageCost} />
      </div>
    </ScrollArea>
  );
}
