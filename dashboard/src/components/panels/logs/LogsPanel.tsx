"use client";

import { Pause, Play, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLogsStore } from "@/stores/logs";
import { LogFilters } from "./LogFilters";
import { LogStream } from "./LogStream";
import { useLogPolling } from "./useLogPolling";

export function LogsPanel() {
  const t = useTranslations("logs");
  const { streaming, setStreaming, clearLogs } = useLogsStore();

  useLogPolling();

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t("title")}</h2>
            {/* Live indicator */}
            {streaming && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--success)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <LogFilters />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                  onClick={clearLogs}
                />
              }
            >
              <Trash2 size={14} />
            </TooltipTrigger>
            <TooltipContent>{t("clear")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-lg transition-colors cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                    streaming
                      ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                  )}
                  onClick={() => setStreaming(!streaming)}
                />
              }
            >
              {streaming ? <Pause size={14} /> : <Play size={14} />}
            </TooltipTrigger>
            <TooltipContent>{streaming ? t("pause") : t("resume")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Log stream */}
      <LogStream />
    </div>
  );
}
