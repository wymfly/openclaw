"use client";

import { useTranslations } from "next-intl";

export function TimelineTab() {
  const t = useTranslations("monitor");

  return (
    <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">
      {t("timeline.selectRun")}
    </div>
  );
}
