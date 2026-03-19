"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMemoryStore, type MemoryTier } from "@/stores/memory";

const TIER_STYLES: Record<MemoryTier, string> = {
  core: "bg-[var(--success-muted)] text-[var(--success)]",
  working: "bg-[var(--accent-muted)] text-[var(--accent)]",
  peripheral: "bg-muted text-muted-foreground",
};

function TierBadge({ tier }: { tier: MemoryTier }) {
  const t = useTranslations("memory");
  const labelKey =
    tier === "core" ? "tierCore" : tier === "working" ? "tierWorking" : "tierPeripheral";
  return <Badge className={cn("text-xs h-auto py-0.5", TIER_STYLES[tier])}>{t(labelKey)}</Badge>;
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
        <Input
          data-panel-search
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("searchPlaceholder")}
          className="flex-1 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
        >
          {t("search")}
        </Button>
      </div>

      {/* LanceDB status indicator */}
      {!isLanceDbEnabled && (
        <div className="text-xs px-3 py-2 rounded-lg bg-[var(--warning-muted)] text-[var(--warning)]">
          {t("lancedbDisabled")}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-xs px-3 py-2 rounded-lg bg-[var(--danger-muted)] text-[var(--danger)]">
          {error}
        </div>
      )}

      {/* Results */}
      <ScrollArea className="flex-1">
        {searchResults.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">{t("noResults")}</p>
          </div>
        )}

        {searchResults.map((result, idx) => (
          <Card key={`${result.path}-${idx}`} size="sm" className="mb-3">
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-1 gap-1.5">
                <span className="text-xs font-medium truncate text-foreground">{result.path}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {result.tier && <TierBadge tier={result.tier} />}
                  {result.decayScore !== undefined && (
                    <Badge className="bg-[var(--purple-muted)] text-[var(--purple)] text-xs h-auto py-0.5">
                      {t("decayScore")}: {(result.decayScore * 100).toFixed(0)}
                    </Badge>
                  )}
                  <Badge className="bg-[var(--accent-muted)] text-[var(--accent)] text-xs h-auto py-0.5">
                    {t("relevance")}: {(result.relevance * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
              <pre className="text-xs whitespace-pre-wrap break-words mt-1 text-muted-foreground font-mono max-h-[120px] overflow-hidden">
                {result.content}
              </pre>
            </div>
          </Card>
        ))}
      </ScrollArea>
    </div>
  );
}
