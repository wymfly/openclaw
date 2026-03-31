"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListSearchBar, PaginatedList } from "@/components/lists";
import type { FilterFieldDef, FilterState } from "@/components/lists/types";
import { useSessionsStore, type SessionsFetchOpts } from "@/stores/sessions";
import { SessionDetail } from "./SessionDetail";
import { SessionList } from "./SessionList";
import { inferSessionType } from "./SessionList";

const PAGE_SIZE = 20;

interface SessionFilters extends FilterState {
  types?: string[];
  activeMinutes?: string;
}

/**
 * SessionsPanel — split layout with session list (left) and detail (right).
 * Search is server-side via sessions.list `search` param.
 * Type filter is client-side (sessions.list has no type param).
 * ActiveMinutes filter is server-side.
 */
export function SessionsPanel() {
  const t = useTranslations("sessions");
  const tc = useTranslations("common");
  const { sessions, selectedKey, loading, error, fetchSessions } = useSessionsStore();

  // Local filter state — NOT in global store to avoid polluting other consumers
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValues, setFilterValues] = useState<SessionFilters>({});
  const [page, setPage] = useState(1);

  const filterDefs: FilterFieldDef[] = useMemo(
    () => [
      {
        key: "types",
        label: t("filterType"),
        type: "multiselect" as const,
        options: [
          { value: "direct", label: t("filterDirect") },
          { value: "group", label: t("filterGroup") },
          { value: "global", label: t("filterGlobal") },
          { value: "subagent", label: t("filterSubagent") },
        ],
      },
      {
        key: "activeMinutes",
        label: t("filterActiveTime"),
        type: "select" as const,
        options: [
          { value: "5", label: t("filterActive5m") },
          { value: "60", label: t("filterActive1h") },
          { value: "1440", label: t("filterActive24h") },
        ],
      },
    ],
    [t],
  );

  // Build fetch opts from local state
  const fetchOpts = useMemo((): SessionsFetchOpts => {
    const opts: SessionsFetchOpts = {};
    if (searchQuery.trim()) {
      opts.search = searchQuery.trim();
    }
    if (filterValues.activeMinutes) {
      opts.activeMinutes = parseInt(filterValues.activeMinutes, 10);
    }
    return opts;
  }, [searchQuery, filterValues.activeMinutes]);

  useEffect(() => {
    void fetchSessions(fetchOpts);
  }, [fetchSessions, fetchOpts]);

  // Client-side type filter
  const typeFilter = filterValues.types;
  const filteredSessions = useMemo(() => {
    if (!typeFilter || typeFilter.length === 0) {
      return sessions;
    }
    return sessions.filter((s) => {
      const sType = inferSessionType(s.key);
      // Map inferSessionType values to spec values
      const specType =
        sType === "dm" ? "direct" : sType === "channel" ? "global" : sType;
      return typeFilter.includes(specType);
    });
  }, [sessions, typeFilter]);

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const pagedSessions = useMemo(
    () => filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredSessions, page],
  );

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterValues]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterChange = useCallback((filters: SessionFilters) => {
    setFilterValues(filters);
  }, []);

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Left sidebar — session list (30%) */}
      <div
        className="flex flex-col border-r"
        style={{
          width: "30%",
          minWidth: 220,
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        {/* Header + search */}
        <div className="px-3 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
            {t("title")}
          </h2>
          <ListSearchBar
            onSearch={handleSearch}
            matchCount={searchQuery ? filteredSessions.length : undefined}
            placeholder={t("searchPlaceholder")}
            filters={filterDefs}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--muted-foreground)" }}
            >
              <p className="text-sm">{tc("loading")}</p>
            </div>
          )}

          {error && !loading && (
            <div
              className="flex items-center justify-center py-12 px-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--muted-foreground)" }}
            >
              <p className="text-sm">{t("noSessions")}</p>
            </div>
          )}

          {!loading && !error && sessions.length > 0 && (
            <PaginatedList
              mode="button"
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalCount={filteredSessions.length}
            >
              <SessionList sessions={pagedSessions} />
            </PaginatedList>
          )}
        </div>
      </div>

      {/* Right detail (70%) */}
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ backgroundColor: "var(--background)" }}
      >
        {selectedKey ? (
          <SessionDetail />
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--muted-foreground)" }}
          >
            <p className="text-sm">{t("noSessions")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
