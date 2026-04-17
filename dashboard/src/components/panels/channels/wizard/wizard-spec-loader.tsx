"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { usePluginsStore } from "@/stores/plugins";
import { FeishuWizard } from "../FeishuWizard";
import { assertValidWizardSpec } from "./wizard-spec.validator";
import { WizardRunner } from "./WizardRunner";

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
  const { loading, plugins, fetchPlugins } = usePluginsStore((state) => ({
    loading: state.loading,
    plugins: state.plugins,
    fetchPlugins: state.fetchPlugins,
  }));

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
  const spec = plugin?.setupWizardSpec;

  if (channelId !== "feishu") {
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
    return <FeishuWizard open={open} onOpenChange={onOpenChange} />;
  }

  try {
    assertValidWizardSpec(spec, channelId);
    return (
      <WizardRunner channelId={channelId} open={open} onOpenChange={onOpenChange} spec={spec} />
    );
  } catch {
    return <FeishuWizard open={open} onOpenChange={onOpenChange} />;
  }
}
