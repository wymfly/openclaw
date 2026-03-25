"use client";

import { LogOut, Power, PowerOff, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useChannelsStore, type ChannelAccount } from "@/stores/channels";
import { BindingsTab } from "./BindingsTab";
import { ChannelSettingsTab } from "./ChannelSettingsTab";

function AccountStatusBadge({ account }: { account: ChannelAccount }) {
  const t = useTranslations("channels");

  if (account.linked && account.connected) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
        style={{
          backgroundColor: "color-mix(in srgb, var(--status-connected) 15%, transparent)",
          color: "var(--status-connected)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: "var(--status-connected)" }}
        />
        {t("linked")}
      </span>
    );
  }

  if (account.lastError) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
        style={{
          backgroundColor: "color-mix(in srgb, var(--status-disconnected) 15%, transparent)",
          color: "var(--status-disconnected)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: "var(--status-disconnected)" }}
        />
        {t("error")}
      </span>
    );
  }

  if (account.enabled) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
          color: "var(--primary)",
        }}
      >
        {t("enabled")}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
      style={{
        backgroundColor: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)",
        color: "var(--muted-foreground)",
      }}
    >
      {t("disabled")}
    </span>
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
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--muted-foreground)" }}
      >
        <p className="text-sm">{t("noChannels")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {channel.label}
        </h2>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          ID: {channel.id}
        </span>
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="status" className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-4 mt-3 shrink-0">
          <TabsTrigger value="status" aria-label={t("tabs.status")}>
            {t("tabs.status")}
          </TabsTrigger>
          <TabsTrigger value="bindings" aria-label={t("tabs.bindings")}>
            {t("tabs.bindings")}
          </TabsTrigger>
          <TabsTrigger value="settings" aria-label={t("tabs.settings")}>
            {t("tabs.settings")}
          </TabsTrigger>
        </TabsList>

        {/* Status tab — original accounts + logout content */}
        <TabsContent value="status" className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 space-y-4">
            {/* Accounts section */}
            <div>
              <label
                className="block text-xs font-medium mb-2"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t("accounts")} ({channel.accounts.length})
              </label>

              {channel.accounts.length === 0 && (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {t("unconfigured")}
                </p>
              )}

              <div className="space-y-2">
                {channel.accounts.map((account) => (
                  <div
                    key={account.accountId}
                    className="rounded-lg px-3 py-2 border"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--card)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                        {account.name ?? account.accountId}
                      </span>
                      <AccountStatusBadge account={account} />
                    </div>

                    {/* Account details */}
                    <div
                      className="flex items-center gap-3 text-[10px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <span>ID: {account.accountId}</span>
                      {account.configured && <span>{t("configured")}</span>}
                    </div>

                    {/* Error message */}
                    {account.lastError && (
                      <div
                        className="flex items-start gap-1.5 mt-1.5 text-[10px] rounded px-2 py-1"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--status-disconnected) 10%, transparent)",
                          color: "var(--status-disconnected)",
                        }}
                      >
                        <AlertCircle size={10} className="shrink-0 mt-0.5" />
                        <span className="break-all">{account.lastError}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => void handleToggleEnabled(account)}
                        disabled={toggling}
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
                        style={{
                          border: "1px solid var(--border)",
                          color: "var(--foreground)",
                          backgroundColor: "var(--background)",
                        }}
                        aria-label={account.enabled ? t("disable") : t("enable")}
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
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logout section */}
            <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              {!confirmLogout ? (
                <button
                  onClick={() => setConfirmLogout(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded hover:opacity-80 transition-opacity"
                  style={{
                    border: "1px solid var(--status-disconnected)",
                    color: "var(--status-disconnected)",
                    backgroundColor: "transparent",
                  }}
                  aria-label={t("logout")}
                >
                  <LogOut size={12} />
                  {t("logout")}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs" style={{ color: "var(--status-disconnected)" }}>
                    {t("confirmLogout")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleLogout()}
                      disabled={loggingOut}
                      className="text-xs px-3 py-1 rounded disabled:opacity-40"
                      style={{
                        backgroundColor: "var(--status-disconnected)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      {t("logout")}
                    </button>
                    <button
                      onClick={() => setConfirmLogout(false)}
                      className="text-xs px-3 py-1 rounded"
                      style={{
                        border: "1px solid var(--border)",
                        color: "var(--muted-foreground)",
                        backgroundColor: "var(--background)",
                      }}
                    >
                      {tc("cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Bindings tab — filtered to this channel */}
        <TabsContent value="bindings" className="flex-1 overflow-hidden">
          <BindingsTab channelId={channelId} />
        </TabsContent>

        {/* Settings tab — DM policy, retry, channel-specific fields */}
        <TabsContent value="settings" className="flex-1 overflow-hidden">
          <ChannelSettingsTab channelId={channelId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
