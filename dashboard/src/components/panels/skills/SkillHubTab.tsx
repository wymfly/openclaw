"use client";

import { ExternalLink, Loader2, Search, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deckFetch } from "@/lib/deck-client";

interface HubSearchResult {
  score: number;
  slug: string;
  displayName: string;
  summary?: string;
  version?: string;
  updatedAt?: number;
}

interface HubDetailResult {
  skill: {
    slug: string;
    displayName: string;
    summary?: string;
    tags?: Record<string, string>;
    createdAt: number;
    updatedAt: number;
  } | null;
  latestVersion?: {
    version: string;
    createdAt: number;
    changelog?: string;
  } | null;
  metadata?: {
    os?: string[] | null;
    systems?: string[] | null;
  } | null;
  owner?: {
    handle?: string;
    displayName?: string;
  } | null;
}

export function SkillHubTab() {
  const t = useTranslations("skills");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HubSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [detail, setDetail] = useState<HubDetailResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setDetail(null);
    try {
      const res = await deckFetch("/api/skills/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", query, limit: 20 }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Search failed" }))) as {
          error?: string;
        };
        setError(err.error ?? "Search failed");
        return;
      }
      const data = (await res.json()) as { results: HubSearchResult[] };
      setResults(data.results ?? []);
    } catch {
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleDetail = useCallback(async (slug: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await deckFetch("/api/skills/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detail", slug }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Detail failed" }))) as {
          error?: string;
        };
        setError(err.error ?? "Detail failed");
        return;
      }
      const data = (await res.json()) as HubDetailResult;
      setDetail(data);
    } catch {
      setError("Detail fetch failed");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
              placeholder={t("hub.searchPlaceholder")}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
          <Button
            variant="default"
            size="sm"
            className="h-8 px-3 text-xs cursor-pointer"
            disabled={searching || !query.trim()}
            onClick={() => void handleSearch()}
          >
            {searching ? <Loader2 size={12} className="animate-spin" /> : t("hub.search")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="rounded-md bg-[var(--destructive-muted)] px-3 py-2">
            <span className="text-xs text-[var(--destructive-muted-text)]">{error}</span>
          </div>
        )}

        {/* Detail view */}
        {detail && detail.skill && (
          <Card className="bg-[var(--background)] border-[var(--primary)]/30 p-4 mb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {detail.skill.displayName}
                </h3>
                <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                  {detail.skill.slug}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] cursor-pointer"
                onClick={() => setDetail(null)}
              >
                {t("hub.backToResults")}
              </Button>
            </div>

            {detail.skill.summary && (
              <p className="text-xs text-[var(--muted-foreground)] mb-3">{detail.skill.summary}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-[10px]">
              {detail.latestVersion && (
                <div>
                  <span className="text-[var(--muted-foreground)]">{t("hub.version")}</span>
                  <p className="font-mono text-[var(--foreground)]">
                    {detail.latestVersion.version}
                  </p>
                </div>
              )}
              {detail.owner?.handle && (
                <div>
                  <span className="text-[var(--muted-foreground)]">{t("hub.author")}</span>
                  <p className="text-[var(--foreground)]">
                    {detail.owner.displayName ?? detail.owner.handle}
                  </p>
                </div>
              )}
              <div>
                <span className="text-[var(--muted-foreground)]">{t("hub.updated")}</span>
                <p className="text-[var(--foreground)]">
                  {new Date(detail.skill.updatedAt).toLocaleDateString()}
                </p>
              </div>
              {detail.metadata?.os && (
                <div>
                  <span className="text-[var(--muted-foreground)]">{t("hub.platforms")}</span>
                  <p className="text-[var(--foreground)]">{detail.metadata.os.join(", ")}</p>
                </div>
              )}
            </div>

            {detail.skill.tags && Object.keys(detail.skill.tags).length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <Tag size={10} className="text-[var(--muted-foreground)]" />
                {Object.entries(detail.skill.tags).map(([k, v]) => (
                  <Badge
                    key={k}
                    variant="outline"
                    className="text-[9px] border-[var(--border)] text-[var(--muted-foreground)]"
                  >
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            )}

            {detail.latestVersion?.changelog && (
              <div className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--muted)] p-3">
                <span className="text-[10px] font-medium text-[var(--foreground)] block mb-1">
                  {t("hub.changelog")}
                </span>
                <pre className="text-[10px] text-[var(--muted-foreground)] whitespace-pre-wrap font-mono">
                  {detail.latestVersion.changelog}
                </pre>
              </div>
            )}
          </Card>
        )}

        {detailLoading && (
          <div className="flex items-center gap-2 py-6 justify-center">
            <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
          </div>
        )}

        {/* Search results */}
        {!detail &&
          results.map((r) => (
            <Card
              key={r.slug}
              className="bg-[var(--background)] border-[var(--border)] p-3 hover:border-[var(--primary)]/30 transition-colors cursor-pointer"
              onClick={() => void handleDetail(r.slug)}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-[var(--foreground)]">
                  {r.displayName}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {r.version && (
                    <Badge
                      variant="outline"
                      className="text-[9px] border-[var(--border)] text-[var(--muted-foreground)]"
                    >
                      v{r.version}
                    </Badge>
                  )}
                  <ExternalLink size={10} className="text-[var(--muted-foreground)]" />
                </div>
              </div>
              <span className="text-[10px] font-mono text-[var(--muted-foreground)] block">
                {r.slug}
              </span>
              {r.summary && (
                <p className="text-[10px] text-[var(--muted-foreground)] mt-1 line-clamp-2">
                  {r.summary}
                </p>
              )}
            </Card>
          ))}

        {!detail && !searching && results.length === 0 && query && (
          <div className="py-6 text-center text-xs text-[var(--muted-foreground)]">
            {t("hub.noResults")}
          </div>
        )}

        {!detail && !searching && results.length === 0 && !query && (
          <div className="py-6 text-center text-xs text-[var(--muted-foreground)]">
            {t("hub.emptyState")}
          </div>
        )}
      </div>
    </div>
  );
}
