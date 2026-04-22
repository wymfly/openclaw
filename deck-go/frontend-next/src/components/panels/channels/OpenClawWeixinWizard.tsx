"use client";

import { CheckCircle2, Copy, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useChannelsStore } from "@/stores/channels";
import { ConfigWizard, type WizardStep } from "./ConfigWizard";

const WEIXIN_CHANNEL_ID = "openclaw-weixin";
const LOGIN_COMMAND = "openclaw channels login --channel openclaw-weixin";

export function OpenClawWeixinWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("channels.weixinWizard");
  const tc = useTranslations("common");
  const { channels, channelOrder, fetchChannels } = useChannelsStore();
  const [copied, setCopied] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);

  const weixinChannel = channels.get(WEIXIN_CHANNEL_ID);
  const pluginVisible = channelOrder.includes(WEIXIN_CHANNEL_ID) || Boolean(weixinChannel);
  const isConnected = weixinChannel?.accounts.some(
    (account) => account.linked || account.connected,
  );

  const copyCommand = useCallback(async () => {
    await navigator.clipboard.writeText(LOGIN_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const refreshStatus = useCallback(async () => {
    setStatusChecked(true);
    await fetchChannels();
  }, [fetchChannels]);

  const introStep = (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
        <Info size={14} className="mt-0.5 shrink-0 text-[var(--primary)]" />
        <div className="space-y-1 text-[var(--muted-foreground)]">
          <p>{t("intro")}</p>
          <p>{pluginVisible ? t("pluginVisible") : t("pluginHidden")}</p>
        </div>
      </div>
    </div>
  );

  const loginStep = (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted-foreground)]">{t("loginDesc")}</p>
      <div className="rounded-lg border bg-[var(--card)] p-3">
        <code className="block text-xs text-[var(--foreground)] break-all">{LOGIN_COMMAND}</code>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => void copyCommand()}>
        <Copy size={12} className="mr-1.5" />
        {copied ? tc("copied") : t("copyCommand")}
      </Button>
    </div>
  );

  const statusStep = (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted-foreground)]">{t("statusDesc")}</p>
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
        <CheckCircle2
          size={14}
          className={isConnected ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}
        />
        <span className="text-[var(--foreground)]">
          {isConnected ? t("connected") : statusChecked ? t("notConnected") : t("statusUnknown")}
        </span>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => void refreshStatus()}>
        {t("refreshStatus")}
      </Button>
    </div>
  );

  const steps: WizardStep[] = useMemo(
    () => [
      { title: t("stepIntro"), content: introStep },
      { title: t("stepLogin"), content: loginStep },
      {
        title: t("stepStatus"),
        content: statusStep,
        validate: async () => {
          if (isConnected) {
            return true;
          }
          await refreshStatus();
          const current = useChannelsStore.getState().channels.get(WEIXIN_CHANNEL_ID);
          return Boolean(current?.accounts.some((account) => account.linked || account.connected));
        },
      },
    ],
    [introStep, isConnected, loginStep, refreshStatus, statusStep, t],
  );

  return (
    <ConfigWizard
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      steps={steps}
      onComplete={() => onOpenChange(false)}
    />
  );
}

export function OpenClawWeixinStatusPanel() {
  const t = useTranslations("channels.weixinWizard");
  const tc = useTranslations("common");
  const { channels, channelOrder, fetchChannels } = useChannelsStore();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const weixinChannel = channels.get(WEIXIN_CHANNEL_ID);
  const pluginVisible = channelOrder.includes(WEIXIN_CHANNEL_ID) || Boolean(weixinChannel);
  const isConnected = weixinChannel?.accounts.some(
    (account) => account.linked || account.connected,
  );

  const copyCommand = useCallback(async () => {
    await navigator.clipboard.writeText(LOGIN_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const refreshStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchChannels();
    } finally {
      setRefreshing(false);
    }
  }, [fetchChannels]);

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      <div className="rounded-lg border bg-[var(--card)] px-3 py-3 text-xs">
        <p className="font-medium text-[var(--foreground)]">{t("title")}</p>
        <p className="mt-1 text-[var(--muted-foreground)]">
          {pluginVisible ? t("pluginVisible") : t("pluginHidden")}
        </p>
      </div>

      <div className="rounded-lg border bg-[var(--card)] px-3 py-3 text-xs">
        <p className="font-medium text-[var(--foreground)]">{t("stepStatus")}</p>
        <p className="mt-1 text-[var(--muted-foreground)]">
          {isConnected ? t("connected") : t("notConnected")}
        </p>
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void copyCommand()}>
            <Copy size={12} className="mr-1.5" />
            {copied ? tc("copied") : t("copyCommand")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={() => void refreshStatus()}
          >
            {refreshing ? tc("loading") : t("refreshStatus")}
          </Button>
        </div>
      </div>
    </div>
  );
}
