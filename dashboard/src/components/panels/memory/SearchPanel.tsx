"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMemoryStore, type MemoryTier } from "@/stores/memory";

// Tier badge colors for visual distinction
const TIER_STYLES: Record<MemoryTier, { bg: string; color: string }> = {
  core: { bg: "var(--success-muted)", color: "var(--success)" },
  working: { bg: "var(--primary-muted)", color: "var(--primary)" },
  peripheral: { bg: "var(--neutral-muted)", color: "var(--neutral-muted-text)" },
};

function TierBadge({ tier }: { tier: MemoryTier }) {
  const t = useTranslations("memory");
  const style = TIER_STYLES[tier];
  const labelKey =
    tier === "core" ? "tierCore" : tier === "working" ? "tierWorking" : "tierPeripheral";
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {t(labelKey)}
    </span>
  );
}

/**
 * SearchPanel — vector search input + results with relevance scores.
 * Displays a "LanceDB not available" notice when the extension is not enabled.
 */
export function SearchPanel() {
  const t = useTranslations("memory");
  const {
    selectedAgentId,
    selectedScope,
    searchResults,
    isLanceDbEnabled,
    loading,
    error,
    searchMemory,
  } = useMemoryStore();

  const [query, setQuery] = useState("");

  const handleSearch = () => {
    const q = query.trim();
    if (!q) {
      return;
    }
    void searchMemory(q, selectedAgentId ?? undefined, selectedScope);
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
          data-panel-search
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("searchPlaceholder")}
          className="flex-1 text-sm rounded px-3 py-2 border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="text-xs px-4 py-2 rounded border cursor-pointer disabled:opacity-50"
          style={{
            borderColor: "var(--primary)",
            backgroundColor: "var(--primary-muted)",
            color: "var(--primary)",
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
            backgroundColor: "var(--warning-muted)",
            color: "var(--warning)",
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
            backgroundColor: "var(--destructive-muted)",
            color: "var(--destructive)",
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
            style={{ color: "var(--muted-foreground)" }}
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
              backgroundColor: "var(--card)",
            }}
          >
            <div className="flex items-center justify-between mb-1 gap-1.5">
              <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
                {result.path}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {result.tier && <TierBadge tier={result.tier} />}
                {result.decayScore !== undefined && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--purple-muted)",
                      color: "var(--purple)",
                    }}
                  >
                    {t("decayScore")}: {(result.decayScore * 100).toFixed(0)}
                  </span>
                )}
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: "var(--primary-muted)",
                    color: "var(--primary)",
                  }}
                >
                  {t("relevance")}: {(result.relevance * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <pre
              className="text-xs whitespace-pre-wrap break-words mt-1"
              style={{
                color: "var(--muted-foreground)",
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
