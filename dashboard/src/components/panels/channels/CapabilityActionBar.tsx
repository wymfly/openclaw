"use client";

import { Loader2, LogIn, Wifi } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useChannelsStore } from "@/stores/channels";
import { usePluginsStore } from "@/stores/plugins";
import { getChannelOnboardingDescriptor } from "./onboarding-registry";

export function CapabilityActionBar({
  channelId,
  onActivateStatusTab,
}: {
  channelId: string;
  onActivateStatusTab?: () => void;
}) {
  const t = useTranslations("channels.actionBar");
  const plugins = usePluginsStore((state) => state.plugins);
  const fetchPlugins = usePluginsStore((state) => state.fetchPlugins);
  const probeChannel = useChannelsStore((state) => state.probeChannel);
  const probing = useChannelsStore((state) => state.probing);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (plugins.length > 0) {
      return;
    }
    void fetchPlugins({ capability: "all" });
  }, [fetchPlugins, plugins.length]);

  const plugin = useMemo(
    () => plugins.find((entry) => entry.channelIds.includes(channelId)),
    [channelId, plugins],
  );
  const caps = plugin?.deckActionCapabilities;
  const onboardingDescriptor = getChannelOnboardingDescriptor(channelId);

  const canLogin = Boolean(caps?.login && onboardingDescriptor);
  const canProbe = Boolean(caps?.probe);

  if (!canLogin && !canProbe) {
    return null;
  }

  const isProbing = probing.has(channelId);

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {canLogin && (
          <Button size="sm" variant="outline" onClick={() => setLoginOpen(true)}>
            <LogIn size={14} />
            {t("login")}
          </Button>
        )}
        {canProbe && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onActivateStatusTab?.();
              void probeChannel(channelId);
            }}
            disabled={isProbing}
          >
            {isProbing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
            {isProbing ? t("probing") : t("probe")}
          </Button>
        )}
      </div>
      {canLogin &&
        onboardingDescriptor?.renderDialog({
          open: loginOpen,
          onOpenChange: setLoginOpen,
        })}
    </>
  );
}
