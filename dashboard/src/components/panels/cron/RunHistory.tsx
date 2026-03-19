"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
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
    return <p className="text-xs px-3 py-8 text-center text-muted-foreground">{t("noRuns")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              {t("startTime")}
            </th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              {t("duration")}
            </th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("status")}</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-border">
              <td className="px-3 py-2 text-foreground">{new Date(run.ts).toLocaleString()}</td>
              <td className="px-3 py-2 text-foreground">
                {run.durationMs != null ? `${run.durationMs}ms` : "—"}
              </td>
              <td className="px-3 py-2">
                <Badge
                  variant={
                    run.status === "ok"
                      ? "default"
                      : run.status === "error"
                        ? "destructive"
                        : "secondary"
                  }
                  className="text-[10px] h-4"
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
