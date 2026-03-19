"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApprovalsStore } from "@/stores/approvals";
import { PendingList } from "./PendingList";
import { PolicyEditor } from "./PolicyEditor";
import { useApprovalsSSE } from "./useApprovalsSSE";

/**
 * ApprovalsPanel — two tabs: Pending approvals + Policy editor.
 *
 * On mount, calls fetchPending() for refresh recovery.
 * SSE events keep the pending list up-to-date in real time.
 */
export function ApprovalsPanel() {
  const t = useTranslations("approvals");
  const fetchPending = useApprovalsStore((s) => s.fetchPending);
  const pendingCount = useApprovalsStore((s) => s.pending.length);
  const [activeTab, setActiveTab] = useState("pending");

  // Connect to SSE for real-time approval events
  useApprovalsSSE();

  // Fetch pending approvals on mount for refresh recovery
  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-lg border border-border">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary flex-wrap">
        <h2 className="text-sm font-semibold shrink-0 text-foreground">{t("title")}</h2>

        {/* Tab bar */}
        <div className="ml-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending">
                {t("pending")}
                {pendingCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 text-[10px] px-1.5 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                  >
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="policy">{t("policy")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "pending" && <PendingList />}
        {activeTab === "policy" && <PolicyEditor />}
      </div>
    </div>
  );
}
