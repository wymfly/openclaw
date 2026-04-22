"use client";

import { useTranslations } from "next-intl";
import { WecomOverviewRoutingSummary } from "./WecomOverviewRoutingSummary";

export function WecomOverviewPage({
  channelId,
  accountId,
}: {
  channelId: string;
  accountId?: string;
}) {
  const t = useTranslations("channels.wecomShell");

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg border px-4 py-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("overviewTitle")}
        </h3>
        <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("overviewDescription")}
        </p>
      </div>
      <WecomOverviewRoutingSummary channelId={channelId} accountId={accountId} />
    </div>
  );
}
