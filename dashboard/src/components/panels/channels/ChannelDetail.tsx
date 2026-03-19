"use client";

import { LogOut, Power, PowerOff, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useChannelsStore, type ChannelAccount } from "@/stores/channels";

function AccountStatusBadge({ account }: { account: ChannelAccount }) {
  const t = useTranslations("channels");

  if (account.linked && account.connected) {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-[var(--success-muted)] text-[var(--status-connected)] gap-1 text-[10px] px-1.5 py-0.5 h-auto"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-connected)]" />
        {t("linked")}
      </Badge>
    );
  }

  if (account.lastError) {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-[var(--danger-muted)] text-[var(--status-disconnected)] gap-1 text-[10px] px-1.5 py-0.5 h-auto"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-disconnected)]" />
        {t("error")}
      </Badge>
    );
  }

  if (account.enabled) {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 h-auto"
      >
        {t("enabled")}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-transparent bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 h-auto"
    >
      {t("disabled")}
    </Badge>
  );
}

export function ChannelDetail({ channelId }: { channelId: string }) {
  const t = useTranslations("channels");
  const tc = useTranslations("common");
  const { channels, logoutChannel, updateChannelConfig } = useChannelsStore();

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toggling, setToggling] = useState(false);

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
      setToggling(true);
      try {
        await updateChannelConfig(channelId, {
          enabled: !account.enabled,
        });
      } finally {
        setToggling(false);
      }
    },
    [channelId, updateChannelConfig],
  );

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">{t("noChannels")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{channel.label}</h2>
        <span className="text-xs text-muted-foreground">ID: {channel.id}</span>
      </div>

      <div className="flex-1 px-4 py-3 space-y-4">
        {/* Accounts section */}
        <div>
          <label className="block text-xs font-medium mb-2 text-muted-foreground">
            {t("accounts")} ({channel.accounts.length})
          </label>

          {channel.accounts.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("unconfigured")}</p>
          )}

          <div className="space-y-2">
            {channel.accounts.map((account) => (
              <Card key={account.accountId} size="sm" className="gap-0 py-0">
                <CardContent className="px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {account.name ?? account.accountId}
                    </span>
                    <AccountStatusBadge account={account} />
                  </div>

                  {/* Account details */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>ID: {account.accountId}</span>
                    {account.configured && <span>{t("configured")}</span>}
                  </div>

                  {/* Error message */}
                  {account.lastError && (
                    <div
                      className={cn(
                        "flex items-start gap-1.5 mt-1.5 text-[10px] rounded px-2 py-1",
                        "bg-[var(--danger-muted)] text-[var(--status-disconnected)]",
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
                      disabled={toggling}
                      className="text-[10px] gap-1"
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Logout section */}
        <div className="pt-2">
          <Separator className="mb-4" />
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
              <p className="text-xs text-destructive">{t("confirmLogout")}</p>
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
