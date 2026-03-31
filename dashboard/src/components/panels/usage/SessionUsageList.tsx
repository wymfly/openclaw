"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { ListSearchBar, useListState } from "@/components/lists";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  useUsageStore,
  type SessionUsageEntry,
  type SessionLogEntry,
} from "@/stores/usage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionUsageListProps {
  sessions: SessionUsageEntry[];
  onNavigateToSession?: (key: string) => void;
}

export function SessionUsageList({
  sessions,
  onNavigateToSession,
}: SessionUsageListProps) {
  const t = useTranslations("usage");
  const fetchSessionLogs = useUsageStore((s) => s.fetchSessionLogs);

  // Expanded session state
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [logs, setLogs] = useState<SessionLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // List state with search and pagination
  const { filteredData, paginatedData, page, totalPages, setPage, filters, setFilters } =
    useListState<SessionUsageEntry, { search?: string }>({
      data: sessions,
      pageSize: 20,
      filterFn: (item: SessionUsageEntry, f: { search?: string }) => {
        if (!f.search) return true;
        const q = f.search.toLowerCase();
        return (
          item.key.toLowerCase().includes(q) ||
          (item.agentId?.toLowerCase().includes(q) ?? false) ||
          (item.label?.toLowerCase().includes(q) ?? false)
        );
      },
    });

  const handleSearch = useCallback(
    (query: string) => {
      setFilters({ search: query || undefined });
    },
    [setFilters],
  );

  const handleToggle = useCallback(
    async (key: string) => {
      if (expandedKey === key) {
        setExpandedKey(null);
        return;
      }
      setExpandedKey(key);
      setLogsLoading(true);
      try {
        const result = await fetchSessionLogs(key);
        setLogs(result);
      } catch {
        setLogs([]);
      } finally {
        setLogsLoading(false);
      }
    },
    [expandedKey, fetchSessionLogs],
  );

  if (sessions.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {t("noSessions")}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header with search */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {t("sessions")} ({filteredData.length})
        </p>
        <div className="w-64">
          <ListSearchBar
            value={filters.search ?? ""}
            onSearch={handleSearch}
            placeholder={t("sessionKey")}
          />
        </div>
      </div>

      {/* Session rows */}
      <div>
        {paginatedData.map((session) => {
          const isExpanded = expandedKey === session.key;
          return (
            <div key={session.key}>
              <button
                type="button"
                className="flex items-center gap-3 px-4 py-2.5 border-b w-full text-left hover:bg-[var(--accent)] transition-colors"
                style={{ borderColor: "var(--border)" }}
                onClick={() => handleToggle(session.key)}
              >
                {/* Expand icon */}
                {isExpanded ? (
                  <ChevronDown
                    size={14}
                    style={{ color: "var(--muted-foreground)" }}
                  />
                ) : (
                  <ChevronRight
                    size={14}
                    style={{ color: "var(--muted-foreground)" }}
                  />
                )}

                {/* Session info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-mono truncate"
                    style={{ color: "var(--foreground)" }}
                    title={session.key}
                  >
                    {session.key}
                  </p>
                  {session.agentId && (
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {session.agentId}
                    </p>
                  )}
                </div>

                {/* Tokens + Cost */}
                <div className="text-right shrink-0">
                  <p
                    className="text-xs tabular-nums"
                    style={{ color: "var(--foreground)" }}
                  >
                    {session.usage
                      ? `${session.usage.totalTokens.toLocaleString()} tokens`
                      : "—"}
                  </p>
                  <p
                    className="text-xs tabular-nums"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {session.usage ? formatCost(session.usage.totalCost) : "—"}
                  </p>
                </div>

                {/* Navigate button */}
                {onNavigateToSession && (
                  <span
                    role="link"
                    tabIndex={0}
                    className="p-1 rounded hover:bg-[var(--accent)]"
                    style={{ color: "var(--muted-foreground)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToSession(session.key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        onNavigateToSession(session.key);
                      }
                    }}
                    title={t("viewDetail")}
                  >
                    <ExternalLink size={12} />
                  </span>
                )}
              </button>

              {/* Expanded logs */}
              {isExpanded && (
                <div
                  className="px-4 py-3 border-b"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--background)",
                  }}
                >
                  {logsLoading ? (
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {t("loadingDetail")}
                    </p>
                  ) : logs.length === 0 ? (
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {t("noData")}
                    </p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th
                            className="text-left py-1 font-medium"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {t("logTimestamp")}
                          </th>
                          <th
                            className="text-left py-1 font-medium"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {t("logEvent")}
                          </th>
                          <th
                            className="text-right py-1 font-medium"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {t("logTokens")}
                          </th>
                          <th
                            className="text-right py-1 font-medium"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {t("logCost")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log, i) => (
                          <tr
                            key={`${log.timestamp}-${i}`}
                            className="border-t"
                            style={{ borderColor: "var(--border)" }}
                          >
                            <td
                              className="py-1 tabular-nums"
                              style={{ color: "var(--foreground)" }}
                            >
                              {formatTime(log.timestamp)}
                            </td>
                            <td
                              className="py-1"
                              style={{ color: "var(--foreground)" }}
                            >
                              {log.role}
                            </td>
                            <td
                              className="py-1 text-right tabular-nums"
                              style={{ color: "var(--foreground)" }}
                            >
                              {log.tokens?.toLocaleString() ?? "—"}
                            </td>
                            <td
                              className="py-1 text-right tabular-nums"
                              style={{ color: "var(--foreground)" }}
                            >
                              {log.cost != null ? formatCost(log.cost) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="px-4 py-2 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(Math.max(1, page - 1))}
                  aria-disabled={page <= 1}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(
                  1,
                  Math.min(page - 2, totalPages - 4),
                );
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === page}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  aria-disabled={page >= totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
