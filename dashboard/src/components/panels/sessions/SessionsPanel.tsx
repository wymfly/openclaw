"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSessionsStore } from "@/stores/sessions";
import { SessionDetail } from "./SessionDetail";
import { SessionList, type SessionType } from "./SessionList";

type FilterValue = SessionType | "all";

/**
 * SessionsPanel — split layout with session list (left) and detail (right).
 */
export function SessionsPanel() {
  const t = useTranslations("sessions");
  const tc = useTranslations("common");
  const { sessions, selectedKey, loading, error, fetchSessions } = useSessionsStore();
  const [typeFilter, setTypeFilter] = useState<FilterValue>("all");

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const filterOptions: { value: FilterValue; label: string }[] = [
    { value: "all", label: t("filterAll") },
    { value: "dm", label: t("filterDirect") },
    { value: "group", label: t("filterGroup") },
    { value: "channel", label: t("filterChannel") },
    { value: "subagent", label: t("filterSubagent") },
  ];

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
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        {/* Header + filter */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            {t("title")}
          </h2>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as FilterValue)}
            className="w-full text-xs rounded px-2 py-1"
            style={{
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="text-sm">{tc("loading")}</p>
            </div>
          )}

          {error && !loading && (
            <div
              className="flex items-center justify-center py-12 px-4"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="text-sm">{t("noSessions")}</p>
            </div>
          )}

          {!loading && !error && sessions.length > 0 && <SessionList typeFilter={typeFilter} />}
        </div>
      </div>

      {/* Right detail (70%) */}
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        {selectedKey ? (
          <SessionDetail />
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{t("noSessions")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
