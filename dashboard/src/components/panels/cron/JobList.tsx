"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      <Button size="sm" className="w-full mb-2" onClick={() => selectJob("__new__")}>
        {t("addJob")}
      </Button>

      {jobs.length === 0 && (
        <p className="text-xs px-3 py-4 text-center text-muted-foreground">{t("noJobs")}</p>
      )}

      {jobs.map((job) => (
        <button
          key={job.id}
          type="button"
          className={cn(
            "w-full text-left px-3 py-2 rounded-md transition-colors text-xs cursor-pointer",
            selectedJobId === job.id
              ? "bg-muted text-foreground"
              : "text-foreground hover:bg-muted/50",
          )}
          onClick={() => selectJob(job.id)}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium truncate">{job.name}</span>
            <Badge variant={job.enabled ? "default" : "secondary"} className="text-[10px] h-4">
              {job.enabled ? t("enabled") : t("disabled")}
            </Badge>
          </div>
          <div className="mt-1 flex justify-between text-muted-foreground">
            <span>{formatSchedule(job)}</span>
            <span>{formatNextRun(job)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
