"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMemoryStore, type MemoryTier } from "@/stores/memory";

const TIER_STYLES: Record<MemoryTier, string> = {
  core: "bg-[var(--success-muted)] text-[var(--success)]",
  working: "bg-[var(--accent-muted)] text-[var(--accent)]",
  peripheral: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
};

function TierBadge({ tier }: { tier: MemoryTier }) {
  const t = useTranslations("memory");
  const labelKey =
    tier === "core" ? "tierCore" : tier === "working" ? "tierWorking" : "tierPeripheral";
  return (
    <Badge className={cn("text-[10px] h-auto py-0.5", TIER_STYLES[tier])}>{t(labelKey)}</Badge>
  );
}

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
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
          />
          <Input
            data-panel-search
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("searchPlaceholder")}
            className="pl-9 text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="cursor-pointer"
        >
          {t("search")}
        </Button>
      </div>

      {/* LanceDB status indicator */}
      {!isLanceDbEnabled && (
        <div className="text-xs px-3 py-2 rounded-lg bg-[var(--warning-muted)] text-[var(--warning-muted-text)]">
          {t("lancedbDisabled")}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-xs px-3 py-2 rounded-lg bg-[var(--danger-muted)] text-[var(--danger-muted-text)]">
          {error}
        </div>
      )}

      {/* Results */}
      <ScrollArea className="flex-1">
        {searchResults.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--text-secondary)]">
            <Search size={18} className="text-[var(--accent)]" />
            <p className="text-sm">{t("noResults")}</p>
          </div>
        )}

        <div className="space-y-2">
          {searchResults.map((result, idx) => (
            <div
              key={`${result.path}-${idx}`}
              className="rounded-xl ring-1 ring-[var(--border)] p-3 card-hover cursor-default"
            >
              <div className="flex items-center justify-between mb-1.5 gap-1.5">
                <span className="text-xs font-medium font-mono truncate text-[var(--text-primary)]">
                  {result.path}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {result.tier && <TierBadge tier={result.tier} />}
                  {result.decayScore !== undefined && (
                    <Badge className="bg-[var(--purple-muted)] text-[var(--purple)] text-[10px] h-auto py-0.5">
                      {t("decayScore")}: {(result.decayScore * 100).toFixed(0)}
                    </Badge>
                  )}
                  <Badge className="bg-[var(--accent-muted)] text-[var(--accent)] text-[10px] h-auto py-0.5">
                    {t("relevance")}: {(result.relevance * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
              <pre className="text-xs whitespace-pre-wrap break-words text-[var(--text-secondary)] font-mono max-h-[120px] overflow-hidden leading-relaxed">
                {result.content}
              </pre>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
