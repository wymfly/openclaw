"use client";

import { useTranslations } from "next-intl";

export function FallbacksTab() {
  const t = useTranslations("models");
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      {t("tabs.fallbacks")} — coming soon
    </div>
  );
}
