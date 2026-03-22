"use client";

import { Plus } from "lucide-react";
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
  return new Date(job.nextRunAtMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function JobList() {
  const t = useTranslations("cron");
  const { jobs, selectedJobId, selectJob } = useCronStore();

  return (
    <div className="flex flex-col gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => selectJob("__new__")}
        className="justify-start gap-1.5 mb-1 text-[var(--accent)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
      >
        <Plus size={14} />
        {t("addJob")}
      </Button>

      {jobs.length === 0 && (
        <p className="text-xs px-3 py-4 text-center text-[var(--text-secondary)]">{t("noJobs")}</p>
      )}

      {jobs.map((job) => {
        const isActive = selectedJobId === job.id;
        return (
          <button
            key={job.id}
            type="button"
            className={cn(
              "relative w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 text-xs cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
              isActive
                ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
            )}
            onClick={() => selectJob(job.id)}
          >
            {/* Active indicator */}
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                aria-hidden
              />
            )}

            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{job.name}</span>
              <Badge
                variant={job.enabled ? "default" : "secondary"}
                className={cn(
                  "text-[10px] h-4",
                  job.enabled
                    ? "bg-[var(--success-muted)] text-[var(--success-muted-text)]"
                    : "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
                )}
              >
                {job.enabled ? t("enabled") : t("disabled")}
              </Badge>
            </div>
            <div className="mt-1 flex justify-between text-[var(--text-secondary)]">
              <span className="font-mono">{formatSchedule(job)}</span>
              <span className="font-mono">{formatNextRun(job)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
