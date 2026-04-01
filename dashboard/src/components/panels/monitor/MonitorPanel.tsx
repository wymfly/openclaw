"use client";

import { MonitorDot } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMonitorStore, type MonitorTab } from "@/stores/monitor";
import { HistoryTab } from "./history/HistoryTab";
import { OverviewTab } from "./overview/OverviewTab";
import { TimelineTab } from "./timeline/TimelineTab";

export function MonitorPanel() {
  const t = useTranslations("monitor");
  const { activeTab, setActiveTab } = useMonitorStore();

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--card)] ring-1 ring-[var(--border)]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--primary-muted)]">
          <MonitorDot size={14} className="text-[var(--primary)]" />
        </div>
        <h2 className="text-sm font-semibold text-[var(--foreground)] tracking-tight">
          {t("title")}
        </h2>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as MonitorTab)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <TabsList className="mx-4 mt-3 shrink-0">
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("tabs.timeline")}</TabsTrigger>
          <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 overflow-auto">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="timeline" className="flex-1 overflow-auto">
          <TimelineTab />
        </TabsContent>
        <TabsContent value="history" className="flex-1 overflow-auto">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
