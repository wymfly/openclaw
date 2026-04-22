"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { navigateToRouting } from "@/lib/panel-navigation";
import { useDeckRoutingStore } from "@/stores/deck-routing";

export function WecomOverviewRoutingSummary({
  channelId,
  accountId,
}: {
  channelId: string;
  accountId?: string;
}) {
  const t = useTranslations("channels.bindingsTab");
  const bindings = useDeckRoutingStore((state) => state.bindings);
  const fetchBindings = useDeckRoutingStore((state) => state.fetchBindings);

  useEffect(() => {
    void fetchBindings();
  }, [fetchBindings]);

  const bindingCount = useMemo(
    () =>
      bindings.filter((binding) => {
        if (binding.match.channel !== channelId) {
          return false;
        }
        if (!accountId) {
          return true;
        }
        return !binding.match.accountId || binding.match.accountId === accountId;
      }).length,
    [accountId, bindings, channelId],
  );

  return (
    <div
      className="rounded-lg border px-4 py-4"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {t("summaryTitle")}
          </h3>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("summaryBindings", { count: bindingCount })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateToRouting({ channelId, accountId })}
          className="inline-flex items-center gap-1 text-xs hover:underline"
          style={{ color: "var(--primary)" }}
        >
          {t("openRouting")}
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}
