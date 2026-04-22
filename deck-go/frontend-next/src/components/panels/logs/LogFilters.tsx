"use client";

import { useTranslations } from "next-intl";
import { useLogsStore, type LogLevel, type LogSource } from "@/stores/logs";

const ALL_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
const ALL_SOURCES: (LogSource | "all")[] = ["all", "gateway", "agent", "channel"];

/**
 * LogFilters — level checkboxes, source dropdown, session text input.
 */
export function LogFilters() {
  const t = useTranslations("logs");
  const { filters, setLevelFilter, setSourceFilter, setSessionFilter } = useLogsStore();

  const toggleLevel = (level: LogLevel) => {
    const current = filters.levels;
    if (current.includes(level)) {
      setLevelFilter(current.filter((l) => l !== level));
    } else {
      setLevelFilter([...current, level]);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Level checkboxes */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
          {t("level")}:
        </span>
        {ALL_LEVELS.map((level) => (
          <label
            key={level}
            className="flex items-center gap-1 text-xs cursor-pointer"
            style={{ color: "var(--foreground)" }}
          >
            <input
              type="checkbox"
              checked={filters.levels.includes(level)}
              onChange={() => toggleLevel(level)}
              style={{ accentColor: "var(--primary)" }}
            />
            {t(level)}
          </label>
        ))}
      </div>

      {/* Source dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
          {t("source")}:
        </span>
        <select
          value={filters.source}
          onChange={(e) => setSourceFilter(e.target.value as LogSource | "all")}
          className="text-xs rounded px-2 py-1 border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--card)",
            color: "var(--foreground)",
          }}
        >
          {ALL_SOURCES.map((src) => (
            <option key={src} value={src}>
              {t(src)}
            </option>
          ))}
        </select>
      </div>

      {/* Session filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
          {t("session")}:
        </span>
        <input
          type="text"
          value={filters.sessionKey}
          onChange={(e) => setSessionFilter(e.target.value)}
          placeholder="session key..."
          className="text-xs rounded px-2 py-1 border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--card)",
            color: "var(--foreground)",
            width: 140,
          }}
        />
      </div>
    </div>
  );
}
