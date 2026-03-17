"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
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
    <button
      type="button"
      className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
      style={{ backgroundColor: "var(--accent)", color: "#fff" }}
      onClick={handleRun}
      disabled={running}
    >
      {running ? "..." : t("runNow")}
    </button>
  );
}
