"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveRunsTab } from "./ActiveRunsTab";
import { ConfigTab } from "./ConfigTab";
import { HistoryTab } from "./HistoryTab";

/**
 * Subagent monitoring panel — three-tab layout:
 *   Active Runs | History | Config
 */
export function SubagentsPanel() {
  const t = useTranslations("subagents");

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="active" className="flex h-full flex-col">
        <TabsList className="mx-4 mt-2 shrink-0">
          <TabsTrigger value="active">{t("activeRuns")}</TabsTrigger>
          <TabsTrigger value="history">{t("history")}</TabsTrigger>
          <TabsTrigger value="config">{t("config")}</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="flex-1 overflow-hidden mt-0">
          <ActiveRunsTab />
        </TabsContent>
        <TabsContent value="history" className="flex-1 overflow-hidden mt-0">
          <HistoryTab />
        </TabsContent>
        <TabsContent value="config" className="flex-1 overflow-hidden mt-0">
          <ConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
