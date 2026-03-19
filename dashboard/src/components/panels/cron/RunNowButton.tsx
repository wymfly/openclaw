"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCronStore } from "@/stores/cron";

interface RunNowButtonProps {
  jobId: string;
}

export function RunNowButton({ jobId }: RunNowButtonProps) {
  const t = useTranslations("cron");
  const { runJob, fetchRuns } = useCronStore();
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    await runJob(jobId);
    // Refresh runs after triggering
    await fetchRuns(jobId);
    setRunning(false);
  };

  return (
    <Button size="sm" onClick={handleRun} disabled={running}>
      {running ? "..." : t("runNow")}
    </Button>
  );
}
