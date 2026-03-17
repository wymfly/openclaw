"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMemoryStore } from "@/stores/memory";

/**
 * SearchPanel — vector search input + results with relevance scores.
 * Displays a "LanceDB not available" notice when the extension is not enabled.
 */
export function SearchPanel() {
  const t = useTranslations("memory");
  const { selectedAgentId, searchResults, isLanceDbEnabled, loading, error, searchMemory } =
    useMemoryStore();

  const [query, setQuery] = useState("");

  const handleSearch = () => {
    const q = query.trim();
    if (!q) {
      return;
    }
    void searchMemory(q, selectedAgentId ?? undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      {/* Search input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("searchPlaceholder")}
          className="flex-1 text-sm rounded px-3 py-2 border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="text-xs px-4 py-2 rounded border cursor-pointer disabled:opacity-50"
          style={{
            borderColor: "var(--accent)",
            backgroundColor: "var(--accent-muted, rgba(59,130,246,0.1))",
            color: "var(--accent)",
          }}
        >
          {t("search")}
        </button>
      </div>

      {/* LanceDB status indicator */}
      {!isLanceDbEnabled && (
        <div
          className="text-xs px-3 py-2 rounded"
          style={{
            backgroundColor: "rgba(234, 179, 8, 0.1)",
            color: "#eab308",
          }}
        >
          {t("lancedbDisabled")}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div
          className="text-xs px-3 py-2 rounded"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "#ef4444",
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {searchResults.length === 0 && !loading && (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{t("noResults")}</p>
          </div>
        )}

        {searchResults.map((result, idx) => (
          <div
            key={`${result.path}-${idx}`}
            className="mb-3 p-3 rounded border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-secondary)",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-xs font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {result.path}
              </span>
              <span
                className="text-xs shrink-0 ml-2 px-2 py-0.5 rounded"
                style={{
                  backgroundColor: "var(--accent-muted, rgba(59,130,246,0.1))",
                  color: "var(--accent)",
                }}
              >
                {t("relevance")}: {(result.relevance * 100).toFixed(0)}%
              </span>
            </div>
            <pre
              className="text-xs whitespace-pre-wrap break-words mt-1"
              style={{
                color: "var(--text-secondary)",
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
                maxHeight: 120,
                overflow: "hidden",
              }}
            >
              {result.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
