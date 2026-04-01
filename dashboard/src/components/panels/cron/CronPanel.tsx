"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useCronStore } from "@/stores/cron";
import { JobForm } from "./JobForm";
import { JobList } from "./JobList";
import { RunHistory } from "./RunHistory";
import { RunNowButton } from "./RunNowButton";

type Tab = "config" | "history";

export function CronPanel() {
  const t = useTranslations("cron");
  const tc = useTranslations("common");

  const { jobs, selectedJobId, loading, error, fetchJobs, selectJob, removeJob } = useCronStore();

  const [tab, setTab] = useState<Tab>("config");

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const isNewJob = selectedJobId === "__new__";

  const handleDelete = async () => {
    if (!selectedJobId || isNewJob) {
      return;
    }
    if (!confirm(t("confirmDelete"))) {
      return;
    }
    await removeJob(selectedJobId);
  };

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h2>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
        {/* Sidebar — job list */}
        <div
          className="w-56 flex-shrink-0 overflow-y-auto border-r p-2"
          style={{ borderColor: "var(--border)" }}
        >
          <JobList />
        </div>

        {/* Detail area */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--muted-foreground)" }}
            >
              <p className="text-sm">{tc("loading")}</p>
            </div>
          )}

          {error && !loading && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--muted-foreground)" }}
            >
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && !selectedJobId && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--muted-foreground)" }}
            >
              <p className="text-sm">{t("noJobs")}</p>
            </div>
          )}

          {!loading && !error && isNewJob && (
            <JobForm
              onDone={() => {
                selectJob(null);
                void fetchJobs();
              }}
            />
          )}

          {!loading && !error && selectedJob && (
            <div className="flex flex-col h-full">
              {/* Tab bar */}
              <div
                className="flex items-center gap-4 px-4 py-2 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  type="button"
                  className="text-xs font-medium pb-1 transition-colors"
                  style={{
                    color: tab === "config" ? "var(--primary)" : "var(--muted-foreground)",
                    borderBottom:
                      tab === "config" ? "2px solid var(--primary)" : "2px solid transparent",
                  }}
                  onClick={() => setTab("config")}
                >
                  {t("configuration")}
                </button>
                <button
                  type="button"
                  className="text-xs font-medium pb-1 transition-colors"
                  style={{
                    color: tab === "history" ? "var(--primary)" : "var(--muted-foreground)",
                    borderBottom:
                      tab === "history" ? "2px solid var(--primary)" : "2px solid transparent",
                  }}
                  onClick={() => setTab("history")}
                >
                  {t("runHistory")}
                </button>

                {/* Actions on the right */}
                <div className="ml-auto flex items-center gap-2">
                  {tab === "history" && <RunNowButton jobId={selectedJob.id} />}
                  <button
                    type="button"
                    className="px-2 py-1 text-xs rounded-md transition-colors"
                    style={{
                      backgroundColor: "var(--destructive)",
                      color: "var(--destructive-fg)",
                    }}
                    onClick={handleDelete}
                  >
                    {t("deleteJob")}
                  </button>
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {tab === "config" && (
                  <JobForm
                    job={selectedJob}
                    onDone={() => {
                      selectJob(null);
                      void fetchJobs();
                    }}
                  />
                )}
                {tab === "history" && <RunHistory jobId={selectedJob.id} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
