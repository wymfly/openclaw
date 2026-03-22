"use client";

import { Play } from "lucide-react";
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
    await fetchRuns(jobId);
    setRunning(false);
  };

  return (
    <Button size="sm" variant="outline" onClick={handleRun} disabled={running} className="gap-1.5">
      <Play size={14} />
      {running ? "..." : t("runNow")}
    </Button>
  );
}
