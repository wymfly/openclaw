"use client";

import { useTranslations } from "next-intl";
import { useLogsStore } from "@/stores/logs";
import { LogFilters } from "./LogFilters";
import { LogStream } from "./LogStream";
import { useLogPolling } from "./useLogPolling";

/**
 * LogsPanel — top toolbar with filters + clear/pause, and log stream below.
 */
export function LogsPanel() {
  const t = useTranslations("logs");
  const { streaming, setStreaming, clearLogs } = useLogsStore();

  // Start polling on mount.
  useLogPolling();

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b gap-3 flex-wrap"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>
            {t("title")}
          </h2>
          <LogFilters />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="text-xs px-3 py-1 rounded border cursor-pointer"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
          >
            {t("clear")}
          </button>
          <button
            onClick={() => setStreaming(!streaming)}
            className="text-xs px-3 py-1 rounded border cursor-pointer"
            style={{
              borderColor: streaming ? "var(--accent)" : "var(--border)",
              backgroundColor: streaming
                ? "var(--accent-muted, rgba(59,130,246,0.1))"
                : "var(--bg-primary)",
              color: streaming ? "var(--accent)" : "var(--text-primary)",
            }}
          >
            {streaming ? t("pause") : t("resume")}
          </button>
        </div>
      </div>

      {/* Log stream */}
      <LogStream />
    </div>
  );
}
