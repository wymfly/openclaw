"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { RefreshCw, ChevronDown } from "lucide-react";
import type { TimeWindow } from "@/stores/usage";

interface DateRangePickerProps {
  timeWindow: TimeWindow;
  startDate: string;
  endDate: string;
  onWindowChange: (window: TimeWindow) => void;
  onCustomRange: (start: string, end: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

const SHORTCUTS: Exclude<TimeWindow, "custom">[] = ["today", "7d", "30d"];

export function DateRangePicker({
  timeWindow,
  startDate,
  endDate,
  onWindowChange,
  onCustomRange,
  onRefresh,
  loading,
}: DateRangePickerProps) {
  const t = useTranslations("usage");
  const [expanded, setExpanded] = useState(false);
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);

  // Sync local state when parent props change (e.g., user clicks shortcut button)
  useEffect(() => {
    setLocalStart(startDate);
    setLocalEnd(endDate);
  }, [startDate, endDate]);

  const handleApplyCustom = () => {
    if (localStart && localEnd && localStart <= localEnd) {
      onCustomRange(localStart, localEnd);
      setExpanded(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Shortcut buttons */}
        <div className="flex gap-1">
          {SHORTCUTS.map((w) => (
            <button
              key={w}
              type="button"
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-colors"
              style={{
                backgroundColor:
                  timeWindow === w ? "var(--primary)" : "transparent",
                color:
                  timeWindow === w
                    ? "var(--primary-foreground)"
                    : "var(--muted-foreground)",
              }}
              onClick={() => onWindowChange(w)}
            >
              {t(w)}
            </button>
          ))}
          {/* Custom toggle */}
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-md font-medium transition-colors inline-flex items-center gap-1"
            style={{
              backgroundColor:
                timeWindow === "custom" ? "var(--primary)" : "transparent",
              color:
                timeWindow === "custom"
                  ? "var(--primary-foreground)"
                  : "var(--muted-foreground)",
            }}
            onClick={() => setExpanded(!expanded)}
          >
            {t("custom")}
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Refresh */}
        <button
          type="button"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--muted-foreground)" }}
          onClick={onRefresh}
          disabled={loading}
          aria-label={t("refresh")}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Custom range panel */}
      {expanded && (
        <div
          className="flex items-center gap-2 p-2 rounded-md border"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("startDate")}
          </label>
          <input
            type="date"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            className="text-xs px-2 py-1 rounded border"
            style={{
              backgroundColor: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
          <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("endDate")}
          </label>
          <input
            type="date"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            className="text-xs px-2 py-1 rounded border"
            style={{
              backgroundColor: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
          <button
            type="button"
            className="px-3 py-1 text-xs rounded-md font-medium"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
            onClick={handleApplyCustom}
          >
            {t("refresh")}
          </button>
        </div>
      )}
    </div>
  );
}
