"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { PanelError } from "@/components/ui/panel-error";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { useChatStore } from "@/stores/chat";
import { useDocsStore } from "@/stores/docs";
import { CategoryFilter } from "./CategoryFilter";
import { DocList } from "./DocList";
import { DocViewer } from "./DocViewer";

export function DocHubPanel() {
  const t = useTranslations("docs");
  const { loading, error, fetchDocs, extractDocs, searchQuery, setSearchQuery } = useDocsStore();
  const activeSessionKey = useChatStore((s) => s.activeSessionKey);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h2>
        <button
          type="button"
          className="px-3 py-1 text-xs font-medium rounded-md"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          onClick={() => void extractDocs(activeSessionKey ?? undefined)}
        >
          {t("extract")}
        </button>
      </div>

      {/* Category Filter */}
      <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <CategoryFilter />
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <input
          data-panel-search
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("search")}
          className="w-full px-3 py-1.5 text-sm rounded-md border outline-none"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
          }}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
        {loading && <PanelSkeleton variant="list" />}

        {error && !loading && <PanelError error={error} onRetry={() => void fetchDocs()} />}

        {!loading && !error && (
          <div className="flex flex-col md:flex-row h-full">
            {/* Left: Doc list */}
            <div
              className="w-full md:w-1/3 md:min-w-[200px] border-b md:border-b-0 md:border-r overflow-y-auto p-3"
              style={{ borderColor: "var(--border)" }}
            >
              <DocList />
            </div>
            {/* Right: Doc viewer */}
            <div className="flex-1 overflow-hidden">
              <DocViewer />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
