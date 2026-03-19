"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useLogsStore } from "@/stores/logs";
import { LogFilters } from "./LogFilters";
import { LogStream } from "./LogStream";
import { useLogPolling } from "./useLogPolling";

export function LogsPanel() {
  const t = useTranslations("logs");
  const { streaming, setStreaming, clearLogs } = useLogsStore();

  useLogPolling();

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden border border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold shrink-0 text-foreground">{t("title")}</h2>
          <LogFilters />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" onClick={clearLogs}>
            {t("clear")}
          </Button>
          <Button
            variant={streaming ? "default" : "outline"}
            size="xs"
            onClick={() => setStreaming(!streaming)}
          >
            {streaming ? t("pause") : t("resume")}
          </Button>
        </div>
      </div>

      {/* Log stream */}
      <LogStream />
    </div>
  );
}
