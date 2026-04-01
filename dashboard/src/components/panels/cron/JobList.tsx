"use client";

import { useTranslations } from "next-intl";
import { useCronStore, type CronJob } from "@/stores/cron";

function formatSchedule(job: CronJob): string {
  const s = job.schedule;
  if (s.kind === "cron" && s.expr) {
    return s.expr;
  }
  if (s.kind === "every" && s.everyMs) {
    return `every ${Math.round(s.everyMs / 1000)}s`;
  }
  if (s.kind === "at" && s.at) {
    return `at ${s.at}`;
  }
  return s.kind;
}

function formatNextRun(job: CronJob): string {
  if (!job.nextRunAtMs) {
    return "—";
  }
  return new Date(job.nextRunAtMs).toLocaleString();
}

export function JobList() {
  const t = useTranslations("cron");
  const { jobs, selectedJobId, selectJob } = useCronStore();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="w-full px-3 py-2 text-xs font-medium rounded-md mb-2 transition-colors"
        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        onClick={() => selectJob("__new__")}
      >
        {t("addJob")}
      </button>

      {jobs.length === 0 && (
        <p className="text-xs px-3 py-4 text-center" style={{ color: "var(--muted-foreground)" }}>
          {t("noJobs")}
        </p>
      )}

      {jobs.map((job) => (
        <button
          key={job.id}
          type="button"
          className="w-full text-left px-3 py-2 rounded-md transition-colors text-xs"
          style={{
            backgroundColor: selectedJobId === job.id ? "var(--muted)" : "transparent",
            color: "var(--foreground)",
          }}
          onClick={() => selectJob(job.id)}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium truncate">{job.name}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: job.enabled ? "var(--primary)" : "var(--muted)",
                color: job.enabled ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              {job.enabled ? t("enabled") : t("disabled")}
            </span>
          </div>
          <div className="mt-1 flex justify-between" style={{ color: "var(--muted-foreground)" }}>
            <span>{formatSchedule(job)}</span>
            <span>{formatNextRun(job)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
