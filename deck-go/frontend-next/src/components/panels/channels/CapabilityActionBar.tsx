"use client";

import { Loader2, LogIn, Wifi } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { resolveChannelUiDefinition } from "@/features/channels/registry/channel-ui-authority";
import { deckFetch } from "@/lib/deck-client";
import { useChannelsStore } from "@/stores/channels";
import { useNotificationsStore } from "@/stores/notifications";
import { usePluginsStore } from "@/stores/plugins";
import { ChannelWizardDialog } from "./wizard/wizard-spec-loader";

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
  const addToast = useNotificationsStore((state) => state.addToast);
  const [loginOpen, setLoginOpen] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

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
  const uiDefinition = resolveChannelUiDefinition({
    channelId,
    plugin,
  });
  const onboardingDescriptor = uiDefinition.onboardingDescriptor;
  const canLogin = uiDefinition.actions.some((action) => action.key === "login" && action.enabled);
  const canProbe = uiDefinition.actions.some((action) => action.key === "probe" && action.enabled);
  const canTestMessage = uiDefinition.actions.some(
    (action) => action.key === "testMessage" && action.enabled,
  );

  if (!canLogin && !canProbe && !canTestMessage) {
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
        {canTestMessage && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              setTestingChannel(channelId);
              try {
                const response = await deckFetch(
                  `/api/channels/${encodeURIComponent(channelId)}/test`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  },
                );
                const body = (await response.json().catch(() => ({}))) as {
                  ok?: boolean;
                  error?: string;
                };
                if (response.ok && body.ok !== false) {
                  addToast("success", t("testMessageSuccess"), 3000);
                } else {
                  addToast("error", body.error ?? t("testMessageFailed"), 3000);
                }
              } catch (error) {
                addToast(
                  "error",
                  error instanceof Error ? error.message : t("testMessageFailed"),
                  3000,
                );
              } finally {
                setTestingChannel(null);
              }
            }}
            disabled={testingChannel === channelId}
          >
            {testingChannel === channelId ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wifi size={14} />
            )}
            {testingChannel === channelId ? t("testingMessage") : t("testMessage")}
          </Button>
        )}
      </div>
      {canLogin &&
        (onboardingDescriptor?.renderDialog({
          open: loginOpen,
          onOpenChange: setLoginOpen,
        }) ??
          (uiDefinition.onboarding.kind === "wizard-spec" ? (
            <ChannelWizardDialog
              channelId={channelId}
              open={loginOpen}
              onOpenChange={setLoginOpen}
            />
          ) : null))}
    </>
  );
}
