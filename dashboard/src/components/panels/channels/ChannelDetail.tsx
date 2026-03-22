"use client";

import { LogOut, Power, PowerOff, AlertCircle, Wand2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useChannelsStore, type ChannelAccount } from "@/stores/channels";
import { FeishuWizard } from "./FeishuWizard";
import { ThroughputChart } from "./ThroughputChart";
import { WeComWizard } from "./WeComWizard";

function AccountStatusBadge({ account }: { account: ChannelAccount }) {
  const t = useTranslations("channels");

  if (account.linked && account.connected) {
    return (
      <Badge className="border-transparent bg-[var(--success-muted)] text-[var(--success-muted-text)] gap-1 text-[10px] px-1.5 py-0.5 h-auto">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-connected)]" />
        {t("linked")}
      </Badge>
    );
  }

  if (account.lastError) {
    return (
      <Badge className="border-transparent bg-[var(--danger-muted)] text-[var(--danger-muted-text)] gap-1 text-[10px] px-1.5 py-0.5 h-auto">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-disconnected)]" />
        {t("error")}
      </Badge>
    );
  }

  if (account.enabled) {
    return (
      <Badge className="border-transparent bg-[var(--accent-muted)] text-[var(--accent)] text-[10px] px-1.5 py-0.5 h-auto">
        {t("enabled")}
      </Badge>
    );
  }

  return (
    <Badge className="border-transparent bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)] text-[10px] px-1.5 py-0.5 h-auto">
      {t("disabled")}
    </Badge>
  );
}

export function ChannelDetail({ channelId }: { channelId: string }) {
  const t = useTranslations("channels");
  const tc = useTranslations("common");
  const { channels, logoutChannel, updateChannelConfig, removeAccount } = useChannelsStore();

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const isWecom = channelId.includes("wecom");
  const isFeishu = channelId.includes("feishu");
  const hasWizard = isWecom || isFeishu;

  const channel = channels.get(channelId);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logoutChannel(channelId);
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  }, [channelId, logoutChannel]);

  const handleToggleEnabled = useCallback(
    async (account: ChannelAccount) => {
      setTogglingId(account.accountId);
      try {
        await updateChannelConfig(channelId, { enabled: !account.enabled }, account.accountId);
      } finally {
        setTogglingId(null);
      }
    },
    [channelId, updateChannelConfig],
  );

  const handleRemoveAccount = useCallback(
    async (accountId: string) => {
      setRemovingId(accountId);
      try {
        await removeAccount(channelId, accountId);
      } finally {
        setRemovingId(null);
        setConfirmRemoveId(null);
      }
    },
    [channelId, removeAccount],
  );

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        <p className="text-sm">{t("noChannels")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{channel.label}</h2>
            <span className="text-xs text-[var(--text-secondary)] font-mono">ID: {channel.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasWizard && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setWizardOpen(true)}
              >
                <Wand2 size={12} />
                {t("configWizard")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Wizard dialogs */}
      {isWecom && <WeComWizard open={wizardOpen} onOpenChange={setWizardOpen} />}
      {isFeishu && <FeishuWizard open={wizardOpen} onOpenChange={setWizardOpen} />}

      <div className="flex-1 px-4 py-3 space-y-4">
        {/* Accounts section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              {t("accounts")} ({channel.accounts.length})
            </label>
            {hasWizard && (
              <Button
                variant="outline"
                size="xs"
                className="gap-1 text-[10px]"
                onClick={() => setWizardOpen(true)}
              >
                <Plus size={10} />
                {t("addAccount")}
              </Button>
            )}
          </div>

          {channel.accounts.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)]">{t("unconfigured")}</p>
          )}

          <div className="space-y-2">
            {channel.accounts.map((account) => (
              <Card key={account.accountId} size="sm" className="card-hover gap-0 py-0">
                <CardContent className="px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {account.name ?? account.accountId}
                    </span>
                    <AccountStatusBadge account={account} />
                  </div>

                  {/* Account details */}
                  <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)] font-mono">
                    <span>ID: {account.accountId}</span>
                    {account.configured && <span>{t("configured")}</span>}
                  </div>

                  {/* Error message */}
                  {account.lastError && (
                    <div
                      className={cn(
                        "flex items-start gap-1.5 mt-1.5 text-[10px] rounded-lg px-2 py-1",
                        "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]",
                      )}
                    >
                      <AlertCircle size={10} className="shrink-0 mt-0.5" />
                      <span className="break-all">{account.lastError}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => void handleToggleEnabled(account)}
                      disabled={togglingId === account.accountId}
                      className="text-[10px] gap-1 transition-colors duration-150"
                    >
                      {account.enabled ? (
                        <>
                          <PowerOff size={10} />
                          {t("disable")}
                        </>
                      ) : (
                        <>
                          <Power size={10} />
                          {t("enable")}
                        </>
                      )}
                    </Button>

                    {/* Remove account */}
                    {confirmRemoveId === account.accountId ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => void handleRemoveAccount(account.accountId)}
                          disabled={removingId === account.accountId}
                          className="text-[10px] gap-1"
                        >
                          <Trash2 size={10} />
                          {t("confirmRemoveAccount")}
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-[10px]"
                        >
                          {tc("cancel")}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setConfirmRemoveId(account.accountId)}
                        className="text-[10px] gap-1 text-[var(--danger)] hover:text-[var(--danger)]"
                      >
                        <Trash2 size={10} />
                        {t("removeAccount")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Throughput chart */}
        <div>
          <Separator className="mb-4 bg-[var(--border-subtle)]" />
          <ThroughputChart channelId={channelId} />
        </div>

        {/* Logout section */}
        <div className="pt-2">
          <Separator className="mb-4 bg-[var(--border-subtle)]" />
          {!confirmLogout ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmLogout(true)}
              className="gap-1.5"
            >
              <LogOut size={12} />
              {t("logout")}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[var(--danger)]">{t("confirmLogout")}</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                >
                  {t("logout")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmLogout(false)}>
                  {tc("cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
