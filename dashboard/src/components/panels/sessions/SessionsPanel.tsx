"use client";

import { ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionsStore } from "@/stores/sessions";
import { ScopeSelector } from "./ScopeSelector";
import { SessionDetail } from "./SessionDetail";
import { SessionList, type SessionType } from "./SessionList";

export function SessionsPanel() {
  const t = useTranslations("sessions");
  const tc = useTranslations("common");
  const { sessions, selectedKey, loading, error, fetchSessions } = useSessionsStore();
  const [typeFilter, setTypeFilter] = useState<SessionType | "all">("all");

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  return (
    <Tabs defaultValue="sessions" className="flex h-full flex-col">
      <TabsList className="mx-4 mt-2 shrink-0">
        <TabsTrigger value="sessions">{t("title")}</TabsTrigger>
        <TabsTrigger value="scope">{t("scopeTab")}</TabsTrigger>
      </TabsList>

      <TabsContent value="sessions" className="flex-1 overflow-hidden mt-0">
        <div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
          {/* Left sidebar — session list (30%) */}
          <div
            className="flex flex-col border-r border-[var(--border)] shrink-0"
            style={{ width: "30%", minWidth: 220 }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t("title")}</h2>
                <Select
                  value={typeFilter}
                  onValueChange={(v) => setTypeFilter((v as SessionType | "all") ?? "all")}
                >
                  <SelectTrigger className="h-6 w-[100px] text-[10px] bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="dm">DM</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                    <SelectItem value="channel">Channel</SelectItem>
                    <SelectItem value="subagent">Subagent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* List body */}
            <ScrollArea className="flex-1">
              {loading && (
                <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
                  <p className="text-sm animate-pulse">{tc("loading")}</p>
                </div>
              )}

              {error && !loading && (
                <div className="flex items-center justify-center py-12 px-4">
                  <div className="px-3 py-2 rounded-lg bg-[var(--danger-muted)] text-[var(--danger-muted-text)] text-xs">
                    {error}
                  </div>
                </div>
              )}

              {!loading && !error && sessions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--text-secondary)]">
                  <ScrollText size={18} className="text-[var(--accent)]" />
                  <p className="text-sm">{t("noSessions")}</p>
                </div>
              )}

              {!loading && !error && sessions.length > 0 && <SessionList typeFilter={typeFilter} />}
            </ScrollArea>
          </div>

          {/* Right detail (70%) */}
          <div className="flex flex-col flex-1 min-w-0">
            {selectedKey ? (
              <SessionDetail />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-secondary)]">
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
                  <ScrollText size={20} className="text-[var(--accent)]" />
                </div>
                <p className="text-sm">{t("noSessions")}</p>
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="scope" className="flex-1 overflow-hidden mt-0">
        <div className="h-full overflow-auto rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
          <ScopeSelector />
        </div>
      </TabsContent>
    </Tabs>
  );
}
