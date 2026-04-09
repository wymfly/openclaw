"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useThreadsStore } from "@/stores/deck-threads";
import { ThreadList } from "./ThreadList";

export function ThreadsPanel() {
  const t = useTranslations("threads");

  const {
    loading,
    error,
    filterAgent,
    filterChannel,
    filterStatus,
    fetchThreads,
    setFilterAgent,
    setFilterChannel,
    setFilterStatus,
  } = useThreadsStore();

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h2>
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        {/* Agent filter */}
        <input
          type="text"
          className="px-2 py-1 text-xs rounded-md border outline-none"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
          }}
          placeholder={t("filterAgent")}
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
        />

        {/* Channel filter */}
        <input
          type="text"
          className="px-2 py-1 text-xs rounded-md border outline-none"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
          }}
          placeholder={t("filterChannel")}
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value)}
        />

        {/* Status toggle */}
        <ToggleGroup
          value={[filterStatus]}
          onValueChange={(v: readonly string[]) => {
            const last = v[v.length - 1];
            if (last === "active" || last === "all") {
              setFilterStatus(last);
            }
          }}
          className="h-7"
        >
          <ToggleGroupItem value="active" className="text-xs px-2.5 h-7">
            {t("statusActive")}
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="text-xs px-2.5 h-7">
            {t("statusAll")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="px-4 py-2 text-xs border-b shrink-0"
          style={{
            borderColor: "var(--border)",
            color: "var(--destructive)",
            backgroundColor: "var(--destructive-muted)",
          }}
        >
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
        {loading && <PanelSkeleton variant="list" />}
        {!loading && <ThreadList />}
      </div>
    </div>
  );
}
