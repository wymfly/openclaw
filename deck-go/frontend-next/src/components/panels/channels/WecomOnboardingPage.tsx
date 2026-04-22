"use client";

import { CheckCircle2, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChannelOnboardingDescriptor } from "@/features/channels/registry/channel-onboarding-descriptors";
import type { ChannelInfo } from "@/stores/channels";

export function WecomOnboardingPage({
  channel,
  onboardingDescriptor,
}: {
  channel: ChannelInfo;
  onboardingDescriptor: ChannelOnboardingDescriptor | null;
}) {
  const t = useTranslations("channels.wecomShell");
  const tw = useTranslations("wizard");
  const [open, setOpen] = useState(false);

  const connectedCount = useMemo(
    () => channel.accounts.filter((account) => account.connected).length,
    [channel.accounts],
  );

  return (
    <>
      <div className="rounded-lg border px-4 py-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {t("onboardingTitle")}
            </h3>
            <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {t("onboardingDescription")}
            </p>
          </div>
          {onboardingDescriptor ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Link2 size={14} />
              {t("openWizard")}
            </Button>
          ) : null}
        </div>

        <div className="mt-4 rounded-lg border px-3 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground)" }}>
            <CheckCircle2 size={14} style={{ color: "var(--primary)" }} />
            {connectedCount > 0
              ? t("onboardingConnected", { count: connectedCount })
              : t("onboardingNotConnected")}
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {tw("wecom.accessTabHint")}
          </p>
        </div>
      </div>
      {onboardingDescriptor?.renderDialog({ open, onOpenChange: setOpen })}
    </>
  );
}
