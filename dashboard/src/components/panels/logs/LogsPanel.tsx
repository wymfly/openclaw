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
  const totalEntries = useLogsStore((s) => s.entries.length);
  const maxEntries = useLogsStore((s) => s.maxEntries);

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
          backgroundColor: "var(--card)",
        }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold shrink-0" style={{ color: "var(--foreground)" }}>
            {t("title")}
          </h2>
          <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--muted-foreground)" }}>
            {t("bufferCount", { current: totalEntries, max: maxEntries })}
          </span>
          <LogFilters />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="text-xs px-3 py-1 rounded border cursor-pointer"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          >
            {t("clear")}
          </button>
          <button
            onClick={() => setStreaming(!streaming)}
            className="text-xs px-3 py-1 rounded border cursor-pointer"
            style={{
              borderColor: streaming ? "var(--primary)" : "var(--border)",
              backgroundColor: streaming ? "var(--primary-muted)" : "var(--background)",
              color: streaming ? "var(--primary)" : "var(--foreground)",
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
