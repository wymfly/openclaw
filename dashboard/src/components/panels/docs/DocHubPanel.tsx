"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useDocsStore } from "@/stores/docs";
import { CategoryFilter } from "./CategoryFilter";
import { DocList } from "./DocList";
import { DocViewer } from "./DocViewer";

export function DocHubPanel() {
  const t = useTranslations("docs");
  const tc = useTranslations("common");
  const { loading, error, fetchDocs, extractDocs, searchQuery, setSearchQuery } = useDocsStore();

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
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("title")}
        </h2>
        <button
          type="button"
          className="px-3 py-1 text-xs font-medium rounded-md"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
          onClick={() => void extractDocs()}
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
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("search")}
          className="w-full px-3 py-1.5 text-sm rounded-md border outline-none"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
        {loading && (
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{tc("loading")}</p>
          </div>
        )}

        {error && !loading && (
          <div
            className="flex items-center justify-center py-12"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="flex h-full">
            {/* Left: Doc list */}
            <div
              className="w-1/3 min-w-[200px] border-r overflow-y-auto p-3"
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
