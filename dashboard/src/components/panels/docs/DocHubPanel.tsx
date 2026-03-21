"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStore } from "@/stores/chat";
import { useDocsStore } from "@/stores/docs";
import { CategoryFilter } from "./CategoryFilter";
import { DocList } from "./DocList";
import { DocViewer } from "./DocViewer";

export function DocHubPanel() {
  const t = useTranslations("docs");
  const tc = useTranslations("common");
  const { loading, error, fetchDocs, extractDocs, searchQuery, setSearchQuery } = useDocsStore();
  const activeSessionId = useChatStore((s) => s.activeSessionKey);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t("title")}</h2>
        <Button size="xs" onClick={() => void extractDocs(activeSessionId ?? undefined)}>
          {t("extract")}
        </Button>
      </div>

      {/* Category Filter */}
      <div className="px-4 py-2 border-b border-[var(--border-subtle)]">
        <CategoryFilter />
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-[var(--border-subtle)]">
        <Input
          data-panel-search
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("search")}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
            <p className="text-sm">{tc("loading")}</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="flex h-full">
            {/* Left: Doc list */}
            <ScrollArea className="w-1/3 min-w-[200px] border-r border-[var(--border)] p-3">
              <DocList />
            </ScrollArea>
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
