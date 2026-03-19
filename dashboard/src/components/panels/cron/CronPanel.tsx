"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCronStore } from "@/stores/cron";
import { JobForm } from "./JobForm";
import { JobList } from "./JobList";
import { RunHistory } from "./RunHistory";
import { RunNowButton } from "./RunNowButton";

export function CronPanel() {
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
    <div className="flex flex-col h-full overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden bg-background">
        {/* Sidebar — job list */}
        <div className="w-56 shrink-0 border-r border-border p-2">
          <ScrollArea className="h-full">
            <JobList />
          </ScrollArea>
        </div>

        {/* Detail area */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">{tc("loading")}</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && !selectedJobId && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
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
            <Tabs value={tab} onValueChange={setTab} className="flex flex-col h-full">
              {/* Tab bar */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <TabsList variant="line">
                  <TabsTrigger value="config">{t("configuration")}</TabsTrigger>
                  <TabsTrigger value="history">{t("runHistory")}</TabsTrigger>
                </TabsList>

                {/* Actions on the right */}
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
    </div>
  );
}
