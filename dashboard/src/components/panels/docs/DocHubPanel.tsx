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
  const activeSessionId = useChatStore((s) => s.activeSessionId);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <Button size="xs" onClick={() => void extractDocs(activeSessionId ?? undefined)}>
          {t("extract")}
        </Button>
      </div>

      {/* Category Filter */}
      <div className="px-4 py-2 border-b">
        <CategoryFilter />
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b">
        <Input
          data-panel-search
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("search")}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden bg-background">
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">{tc("loading")}</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="flex h-full">
            {/* Left: Doc list */}
            <ScrollArea className="w-1/3 min-w-[200px] border-r p-3">
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
