"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useSessionsStore } from "@/stores/sessions";
import { SessionDetail } from "./SessionDetail";
import { SessionList } from "./SessionList";

/**
 * SessionsPanel — split layout with session list (left) and detail (right).
 */
export function SessionsPanel() {
  const t = useTranslations("sessions");
  const tc = useTranslations("common");
  const { sessions, selectedKey, loading, error, fetchSessions } = useSessionsStore();

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

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
        {/* Header */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("title")}
          </h2>
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

          {!loading && !error && sessions.length > 0 && <SessionList />}
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
