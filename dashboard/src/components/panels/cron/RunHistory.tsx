"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
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
      <p className="text-xs px-3 py-8 text-center" style={{ color: "var(--muted-foreground)" }}>
        {t("noRuns")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderColor: "var(--border)" }} className="border-b">
            <th
              className="text-left px-3 py-2 font-medium"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t("startTime")}
            </th>
            <th
              className="text-left px-3 py-2 font-medium"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t("duration")}
            </th>
            <th
              className="text-left px-3 py-2 font-medium"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t("status")}
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} style={{ borderColor: "var(--border)" }} className="border-b">
              <td className="px-3 py-2" style={{ color: "var(--foreground)" }}>
                {new Date(run.ts).toLocaleString()}
              </td>
              <td className="px-3 py-2" style={{ color: "var(--foreground)" }}>
                {run.durationMs != null ? `${run.durationMs}ms` : "—"}
              </td>
              <td className="px-3 py-2">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    backgroundColor:
                      run.status === "ok"
                        ? "var(--success)"
                        : run.status === "error"
                          ? "var(--destructive)"
                          : "var(--muted)",
                    color:
                      run.status === "skipped"
                        ? "var(--muted-foreground)"
                        : "var(--primary-foreground)",
                  }}
                >
                  {t(run.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
