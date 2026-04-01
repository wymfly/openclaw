"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCronStore } from "@/stores/cron";
import { HeartbeatConfig } from "./HeartbeatConfig";
import { JobForm } from "./JobForm";
import { JobList } from "./JobList";
import { NextExecutionCountdown } from "./NextExecutionCountdown";
import { RunHistory } from "./RunHistory";
import { RunNowButton } from "./RunNowButton";

function CronJobsContent() {
  const t = useTranslations("cron");
  const tc = useTranslations("common");

  const { jobs, selectedJobId, loading, error, fetchJobs, selectJob, removeJob } = useCronStore();

  const [tab, setTab] = useState("config");

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
    <div className="flex h-full overflow-hidden">
      {/* Sidebar -- job list */}
      <aside className="flex flex-col w-56 shrink-0 border-r border-[var(--border)] h-full">
        <ScrollArea className="flex-1">
          <div className="p-2">
            <JobList />
          </div>
        </ScrollArea>
      </aside>

      {/* Detail area */}
      <div className="flex flex-col flex-1 min-w-0">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--muted-foreground)]">
            <p className="text-sm">{tc("loading")}</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--muted-foreground)]">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && !selectedJobId && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--muted-foreground)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
              <Clock size={20} className="text-[var(--primary)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">{t("noJobs")}</p>
            </div>
          </div>
        )}

        {!loading && !error && isNewJob && (
          <ScrollArea className="flex-1">
            <JobForm
              onDone={() => {
                selectJob(null);
                void fetchJobs();
              }}
            />
          </ScrollArea>
        )}

        {!loading && !error && selectedJob && (
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col h-full">
            {/* Tab bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
              <TabsList variant="line">
                <TabsTrigger value="config">{t("configuration")}</TabsTrigger>
                <TabsTrigger value="history">{t("runHistory")}</TabsTrigger>
              </TabsList>

              <NextExecutionCountdown
                nextRunAtMs={selectedJob.nextRunAtMs}
                disabled={!selectedJob.enabled}
              />

              <div className="ml-auto flex items-center gap-2">
                {tab === "history" && <RunNowButton jobId={selectedJob.id} />}
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  {t("deleteJob")}
                </Button>
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              <TabsContent value="config">
                <JobForm
                  job={selectedJob}
                  onDone={() => {
                    selectJob(null);
                    void fetchJobs();
                  }}
                />
              </TabsContent>
              <TabsContent value="history">
                <RunHistory jobId={selectedJob.id} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>
    </div>
  );
}

export function SchedulerPanel() {
  const ts = useTranslations("scheduler");

  const [activeTab, setActiveTab] = useState("cron");

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--card)] ring-1 ring-[var(--border)]">
      {/* Top-level scheduler tabs */}
      <div className="flex items-center px-4 py-2 border-b border-[var(--border)]">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList variant="line">
            <TabsTrigger value="cron">{ts("cronJobs")}</TabsTrigger>
            <TabsTrigger value="heartbeat">{ts("heartbeat")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === "cron" && <CronJobsContent />}
        {activeTab === "heartbeat" && <HeartbeatConfig />}
      </div>
    </div>
  );
}
