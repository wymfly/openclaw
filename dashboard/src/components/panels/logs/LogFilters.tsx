"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLogsStore, type LogLevel, type LogSource } from "@/stores/logs";

const ALL_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
const ALL_SOURCES: (LogSource | "all")[] = ["all", "gateway", "agent", "channel"];

const LEVEL_DOT_COLORS: Record<LogLevel, string> = {
  debug: "bg-[var(--neutral-muted-text)]",
  info: "bg-[var(--accent)]",
  warn: "bg-[var(--warning)]",
  error: "bg-[var(--danger)]",
};

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
      {/* Level toggles */}
      <div className="flex items-center gap-1">
        {ALL_LEVELS.map((level) => {
          const active = filters.levels.includes(level);
          return (
            <button
              key={level}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                active
                  ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
              onClick={() => toggleLevel(level)}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0 transition-opacity",
                  LEVEL_DOT_COLORS[level],
                  !active && "opacity-30",
                )}
              />
              {t(level)}
            </button>
          );
        })}
      </div>

      {/* Source dropdown */}
      <Select
        value={filters.source}
        onValueChange={(val) => setSourceFilter(val as LogSource | "all")}
      >
        <SelectTrigger className="w-[100px] h-7 text-xs" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALL_SOURCES.map((src) => (
            <SelectItem key={src} value={src}>
              {t(src)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Session filter */}
      <Input
        type="text"
        value={filters.sessionKey}
        onChange={(e) => setSessionFilter(e.target.value)}
        placeholder="session key..."
        className="text-xs h-7 w-[140px]"
      />
    </div>
  );
}
