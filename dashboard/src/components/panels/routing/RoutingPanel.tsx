"use client";

import { Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "./ActivityFeed";
import { BindingTable } from "./BindingTable";
import { RouteSimulator } from "./RouteSimulator";

/**
 * Routing panel — binding rules table + route simulator + activity feed.
 * Desktop (≥1280px): side-by-side with toggle between Simulator/Activity on the right.
 * Mobile (<1280px): three-tab layout.
 */
export function RoutingPanel() {
  const t = useTranslations("routing");
  const isWide = useMediaQuery("(min-width: 1280px)");
  const [rightPane, setRightPane] = useState<"simulator" | "activity">("simulator");
  const [mobileTab, setMobileTab] = useState("bindings");

  if (isWide) {
    return (
      <div className="flex h-full gap-4 overflow-hidden">
        {/* Left: Binding Table */}
        <div className="flex-[3] min-w-0 rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] shrink-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("bindings")}</h3>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 text-xs h-7",
                rightPane === "activity" && "text-[var(--accent)]",
              )}
              onClick={() => setRightPane((p) => (p === "simulator" ? "activity" : "simulator"))}
            >
              <Activity className="size-3.5" />
              {t("activityFeed")}
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <BindingTable />
          </div>
        </div>

        {/* Right: Simulator or Activity Feed */}
        <div className="flex-[2] min-w-0 rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)] overflow-hidden">
          {rightPane === "simulator" ? <RouteSimulator /> : <ActivityFeed />}
        </div>
      </div>
    );
  }

  // Mobile / narrow: tabbed layout
  return (
    <Tabs
      value={mobileTab}
      onValueChange={setMobileTab}
      className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]"
    >
      <div className="flex items-center px-4 py-2 border-b border-[var(--border)] shrink-0">
        <TabsList variant="line">
          <TabsTrigger value="bindings" className="cursor-pointer">
            {t("bindings")}
          </TabsTrigger>
          <TabsTrigger value="simulator" className="cursor-pointer">
            {t("simulator")}
          </TabsTrigger>
          <TabsTrigger value="activity" className="cursor-pointer">
            {t("activityFeed")}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="bindings" className="flex-1 min-h-0 overflow-auto">
        <BindingTable />
      </TabsContent>
      <TabsContent value="simulator" className="flex-1 min-h-0 overflow-auto">
        <RouteSimulator />
      </TabsContent>
      <TabsContent value="activity" className="flex-1 min-h-0 overflow-auto">
        <ActivityFeed />
      </TabsContent>
    </Tabs>
  );
}
