"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCronStore } from "@/stores/cron";

interface RunHistoryProps {
  jobId: string;
}

export function RunHistory({ jobId }: RunHistoryProps) {
  const t = useTranslations("cron");
  const { runs, fetchRuns } = useCronStore();

  useEffect(() => {
    void fetchRuns(jobId);
  }, [jobId, fetchRuns]);

  if (runs.length === 0) {
    return (
      <p className="text-xs px-3 py-8 text-center text-[var(--text-secondary)]">{t("noRuns")}</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left px-4 py-2.5 font-medium text-[var(--text-secondary)]">
              {t("startTime")}
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-[var(--text-secondary)]">
              {t("duration")}
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-[var(--text-secondary)]">
              {t("status")}
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              className="border-b border-[var(--border-subtle)] transition-colors duration-150 hover:bg-[var(--bg-tertiary)]"
            >
              <td className="px-4 py-2.5 font-mono text-[var(--text-primary)]">
                {new Date(run.ts).toLocaleString()}
              </td>
              <td className="px-4 py-2.5 font-mono text-[var(--text-primary)]">
                {run.durationMs != null ? `${run.durationMs}ms` : "—"}
              </td>
              <td className="px-4 py-2.5">
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] h-4",
                    run.status === "ok" &&
                      "bg-[var(--success-muted)] text-[var(--success-muted-text)]",
                    run.status === "error" &&
                      "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]",
                    run.status !== "ok" &&
                      run.status !== "error" &&
                      "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
                  )}
                >
                  {t(run.status)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
