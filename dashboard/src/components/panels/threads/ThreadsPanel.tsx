"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useThreadsStore } from "@/stores/deck-threads";
import { ThreadList } from "./ThreadList";

export function ThreadsPanel() {
  const t = useTranslations("threads");
  const tc = useTranslations("common");

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
        <div
          className="flex rounded-md overflow-hidden border"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            className="px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor: filterStatus === "active" ? "var(--primary)" : "var(--background)",
              color:
                filterStatus === "active" ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
            onClick={() => setFilterStatus("active")}
          >
            {t("statusActive")}
          </button>
          <button
            type="button"
            className="px-2.5 py-1 text-xs font-medium transition-colors border-l"
            style={{
              borderColor: "var(--border)",
              backgroundColor: filterStatus === "all" ? "var(--primary)" : "var(--background)",
              color:
                filterStatus === "all" ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
            onClick={() => setFilterStatus("all")}
          >
            {t("statusAll")}
          </button>
        </div>
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
        {loading && (
          <div
            className="flex items-center justify-center h-full text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            {tc("loading")}
          </div>
        )}
        {!loading && <ThreadList />}
      </div>
    </div>
  );
}
