"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveChannelUiDefinition } from "@/features/channels/registry/channel-ui-authority";
import { usePluginsStore } from "@/stores/plugins";
import { assertValidWizardSpec } from "./wizard-spec.validator";
import { WizardRunner } from "./WizardRunner";

function WizardUnavailableDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("wizard");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("unavailableTitle")}</DialogTitle>
          <DialogDescription>{t("unavailableDescription")}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export function ChannelWizardDialog({
  channelId,
  open,
  onOpenChange,
}: {
  channelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tc = useTranslations("common");
  const loading = usePluginsStore((state) => state.loading);
  const plugins = usePluginsStore((state) => state.plugins);
  const fetchPlugins = usePluginsStore((state) => state.fetchPlugins);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (plugins.length > 0) {
      return;
    }
    void fetchPlugins({ capability: "all" });
  }, [fetchPlugins, open, plugins.length]);

  const plugin = useMemo(
    () => plugins.find((entry) => entry.channelIds.includes(channelId)),
    [channelId, plugins],
  );
  const uiDefinition = resolveChannelUiDefinition({
    channelId,
    plugin,
  });
  const spec = uiDefinition.fallback.wizardSpec;
  const title = plugin?.name ?? channelId;

  if (uiDefinition.onboarding.kind !== "wizard-spec") {
    return null;
  }

  if (loading && plugins.length === 0) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
        {tc("loading")}
      </div>
    );
  }

  if (!spec) {
    return <WizardUnavailableDialog open={open} onOpenChange={onOpenChange} />;
  }

  try {
    assertValidWizardSpec(spec, channelId);
    return (
      <WizardRunner
        channelId={channelId}
        open={open}
        onOpenChange={onOpenChange}
        spec={spec}
        title={title}
      />
    );
  } catch {
    return <WizardUnavailableDialog open={open} onOpenChange={onOpenChange} />;
  }
}
