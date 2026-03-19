"use client";

import { useTranslations } from "next-intl";

export function CatalogTab() {
  const t = useTranslations("models");
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      {t("tabs.catalog")} — coming soon
    </div>
  );
}
