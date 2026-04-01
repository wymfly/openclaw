"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useApprovalsStore } from "@/stores/approvals";
import { PendingList } from "./PendingList";
import { PolicyEditor } from "./PolicyEditor";
import { useApprovalsSSE } from "./useApprovalsSSE";

type ApprovalsTab = "pending" | "policy";

const TABS: ApprovalsTab[] = ["pending", "policy"];
const TAB_LABEL_KEYS: Record<ApprovalsTab, string> = {
  pending: "pending",
  policy: "policy",
};

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
  const [activeTab, setActiveTab] = useState<ApprovalsTab>("pending");

  // Connect to SSE for real-time approval events
  useApprovalsSSE();

  // Fetch pending approvals on mount for refresh recovery
  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-wrap"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <h2 className="text-sm font-semibold shrink-0" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h2>

        {/* Tab bar */}
        <div className="flex items-center gap-1 ml-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="text-xs px-3 py-1 rounded border cursor-pointer"
              style={{
                borderColor: activeTab === tab ? "var(--primary)" : "var(--border)",
                backgroundColor: activeTab === tab ? "var(--primary-muted)" : "var(--background)",
                color: activeTab === tab ? "var(--primary)" : "var(--foreground)",
              }}
            >
              {t(TAB_LABEL_KEYS[tab])}
              {tab === "pending" && pendingCount > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: "var(--warning-muted)",
                    color: "var(--warning)",
                    fontSize: "0.65rem",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
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
