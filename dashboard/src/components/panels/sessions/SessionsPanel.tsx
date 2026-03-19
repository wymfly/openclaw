"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSessionsStore } from "@/stores/sessions";
import { SessionDetail } from "./SessionDetail";
import { SessionList } from "./SessionList";

export function SessionsPanel() {
  const t = useTranslations("sessions");
  const tc = useTranslations("common");
  const { sessions, selectedKey, loading, error, fetchSessions } = useSessionsStore();

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  return (
    <div className="flex h-full rounded-lg overflow-hidden border border-border">
      {/* Left sidebar — session list (30%) */}
      <div
        className="flex flex-col border-r border-border bg-card"
        style={{ width: "30%", minWidth: 220 }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        </div>

        {/* List body */}
        <ScrollArea className="flex-1">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">{tc("loading")}</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center justify-center py-12 px-4 text-muted-foreground">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">{t("noSessions")}</p>
            </div>
          )}

          {!loading && !error && sessions.length > 0 && <SessionList />}
        </ScrollArea>
      </div>

      {/* Right detail (70%) */}
      <div className="flex flex-col flex-1 min-w-0 bg-background">
        {selectedKey ? (
          <SessionDetail />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">{t("noSessions")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
