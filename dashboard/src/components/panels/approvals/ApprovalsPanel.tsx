"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApprovalsStore } from "@/stores/approvals";
import { PendingList } from "./PendingList";
import { PolicyEditor } from "./PolicyEditor";
import { useApprovalsSSE } from "./useApprovalsSSE";

export function ApprovalsPanel() {
  const t = useTranslations("approvals");
  const fetchPending = useApprovalsStore((s) => s.fetchPending);
  const pendingCount = useApprovalsStore((s) => s.pending.length);
  const [activeTab, setActiveTab] = useState("pending");

  useApprovalsSSE();

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] flex-wrap shrink-0">
        <div className="ml-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList variant="line">
              <TabsTrigger value="pending">
                {t("pending")}
                {pendingCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 h-4 text-[10px] px-1.5 bg-[var(--warning-muted)] text-[var(--warning-muted-text)]"
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
