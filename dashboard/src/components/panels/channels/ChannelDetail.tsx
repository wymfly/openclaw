"use client";

import { LogOut, Power, PowerOff, AlertCircle, Settings2, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback, useEffect, useMemo } from "react";
import { navigateToPlugin } from "../../../lib/panel-navigation";
import { useChannelsStore, type ChannelAccount } from "../../../stores/channels";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";
import { getAccessDescriptor } from "./access-descriptors/access-descriptor-registry";
import { AccessPanel } from "./access-descriptors/AccessPanel";
import { AccountConfigDialog } from "./AccountConfigDialog";
import { BindingsTab } from "./BindingsTab";
import {
  countChannelAlerts,
  getAccountHealthAlert,
  hasChannelProbeAlert,
} from "./channel-health-alerts";
import { getAccountHealthDiagnostic } from "./channel-health-diagnostics";
import { ChannelAccessTab } from "./ChannelAccessTab";
import { ChannelAnalytics } from "./ChannelAnalytics";
import { ChannelHealthBadge } from "./ChannelHealthBadge";
import { ChannelProbeStatus } from "./ChannelProbeStatus";
import { ChannelSettingsTab } from "./ChannelSettingsTab";
import { ChannelTestTool } from "./ChannelTestTool";

const DIAGNOSTIC_TONE_STYLES = {
  success: {
    bg: "var(--success-muted)",
    text: "var(--success-muted-text)",
  },
  warning: {
    bg: "var(--warning-muted)",
    text: "var(--warning-muted-text)",
  },
  error: {
    bg: "var(--destructive-muted)",
    text: "var(--destructive)",
  },
  neutral: {
    bg: "var(--muted)",
    text: "var(--foreground)",
  },
} as const;

const ALERT_SEVERITY_STYLES = {
  error: {
    border: "var(--destructive)",
    bg: "var(--destructive-muted)",
    text: "var(--destructive)",
  },
  warning: {
    border: "var(--warning)",
    bg: "var(--warning-muted)",
    text: "var(--warning-muted-text)",
  },
} as const;

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

function AccountAlertCard({
  title,
  description,
  severity,
}: {
  title: string;
  description: string;
  severity: "error" | "warning";
}) {
  const styles = ALERT_SEVERITY_STYLES[severity];
  return (
    <div
      className="mb-2 rounded-md border px-2.5 py-2"
      style={{
        borderColor: styles.border,
        backgroundColor: styles.bg,
        color: styles.text,
      }}
    >
      <p className="text-[11px] font-semibold">{title}</p>
      <p className="mt-1 text-[11px]">{description}</p>
    </div>
  );
}

function AccountDiagnosticCard({
  title,
  description,
  nextStep,
  tone,
}: {
  title: string;
  description: string;
  nextStep: string;
  tone: keyof typeof DIAGNOSTIC_TONE_STYLES;
}) {
  const styles = DIAGNOSTIC_TONE_STYLES[tone];
  return (
    <div
      className="mb-2 rounded-md px-2.5 py-2"
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
      }}
    >
      <p className="text-[11px] font-semibold">{title}</p>
      <p className="mt-1 text-[11px]">{description}</p>
      <p className="mt-2 text-[10px] font-medium">{nextStep}</p>
    </div>
  );
}

export function ChannelDetail({ channelId }: { channelId: string }) {
  const t = useTranslations("channels");
  const tc = useTranslations("common");
  const {
    channels,
    logoutChannel,
    updateChannelConfig,
    channelSchemas,
    channelHealthMap,
    fetchChannelConfig,
    saveChannelConfig,
    pendingAccessTarget,
    setPendingAccessTarget,
  } = useChannelsStore();

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [configAccount, setConfigAccount] = useState<ChannelAccount | null>(null);
  const [activeTab, setActiveTab] = useState("status");
  const [accessAccountId, setAccessAccountId] = useState<string | undefined>(undefined);

  const channel = channels.get(channelId);
  const channelHealth = channelHealthMap.get(channelId);
  const probeResult = useChannelsStore((s) => s.probeResults.get(channelId));
  const alertCount = channel ? countChannelAlerts(channel) : 0;
  const hasProbeAlert = hasChannelProbeAlert(probeResult);

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

  const schemaInfo = channelSchemas.get(channelId);
  const availableAccountIds = useMemo(
    () => new Set(channel?.accounts.map((account) => account.accountId) ?? []),
    [channel?.accounts],
  );

  useEffect(() => {
    const fallbackAccountId = channel?.defaultAccountId ?? channel?.accounts[0]?.accountId;
    setAccessAccountId((current) => {
      if (current && availableAccountIds.has(current)) {
        return current;
      }
      return fallbackAccountId;
    });
  }, [availableAccountIds, channel?.defaultAccountId, channel?.accounts]);

  useEffect(() => {
    if (!pendingAccessTarget || pendingAccessTarget.channelId !== channelId) {
      return;
    }
    const fallbackAccountId = channel?.defaultAccountId ?? channel?.accounts[0]?.accountId;
    setAccessAccountId(pendingAccessTarget.accountId ?? fallbackAccountId);
    setActiveTab("access");
    setPendingAccessTarget(null);
  }, [
    channel?.accounts,
    channel?.defaultAccountId,
    channelId,
    pendingAccessTarget,
    setPendingAccessTarget,
  ]);

  // Schema-only channel (discovered but not yet configured via channels.status)
  if (!channel && schemaInfo) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {channelId}
          </h2>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("unconfigured")}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChannelSettingsTab channelId={channelId} />
        </div>
      </div>
    );
  }

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

  const accessDescriptor = getAccessDescriptor(channelId);
  const openAccessTabWithAccount = useCallback(
    (accountId?: string) => {
      if (accountId) {
        setAccessAccountId(accountId);
      }
      setActiveTab("access");
    },
    [setAccessAccountId, setActiveTab],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {channel.label}
          </h2>
          {channelHealth && (
            <ChannelHealthBadge
              status={channelHealth.status}
              latencyMs={channelHealth.latencyMs}
              error={channelHealth.error}
              lastCheckedAt={channelHealth.lastCheckedAt}
            />
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          ID: {channel.id}
        </span>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <span style={{ color: "var(--muted-foreground)" }}>
            {t("pluginInfo.label")}:{" "}
            <span style={{ color: "var(--foreground)" }}>
              {channel.pluginId ?? t("pluginInfo.unavailable")}
            </span>
          </span>
          {channel.pluginOrigin && (
            <span style={{ color: "var(--muted-foreground)" }}>
              {t("pluginInfo.origin")}:{" "}
              <span style={{ color: "var(--foreground)" }}>{channel.pluginOrigin}</span>
            </span>
          )}
          {channel.pluginConfigPath && (
            <span style={{ color: "var(--muted-foreground)" }}>
              {t("pluginInfo.configPath")}:{" "}
              <span style={{ color: "var(--foreground)" }}>{channel.pluginConfigPath}</span>
            </span>
          )}
          {channel.pluginId && (
            <button
              type="button"
              onClick={() => navigateToPlugin(channel.pluginId)}
              className="inline-flex items-center gap-1 hover:underline"
              style={{ color: "var(--primary)" }}
            >
              {t("pluginInfo.open")}
              <ExternalLink size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Tabbed content */}
      <Tabs
        defaultValue="status"
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <TabsList className="mx-4 mt-3 shrink-0">
          <TabsTrigger value="status" aria-label={t("tabs.status")}>
            {t("tabs.status")}
          </TabsTrigger>
          <TabsTrigger value="access" aria-label={t("tabs.access")}>
            {t("tabs.access")}
          </TabsTrigger>
          <TabsTrigger value="bindings" aria-label={t("tabs.bindings")}>
            {t("tabs.bindings")}
          </TabsTrigger>
          <TabsTrigger value="settings" aria-label={t("tabs.settings")}>
            {t("tabs.settings")}
          </TabsTrigger>
          <TabsTrigger value="analytics" aria-label={t("tabs.analytics")}>
            {t("tabs.analytics")}
          </TabsTrigger>
        </TabsList>

        {/* Status tab — probe + accounts + logout */}
        <TabsContent value="status" className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 space-y-4">
            {/* Connection probe + test tool */}
            <div className="pb-3 border-b" style={{ borderColor: "var(--border)" }}>
              <label
                className="block text-xs font-medium mb-2"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t("probe.title")}
              </label>
              <ChannelProbeStatus channelId={channelId} />
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <label
                  className="block text-xs font-medium mb-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {t("test.title")}
                </label>
                <ChannelTestTool channelId={channelId} />
              </div>
            </div>

            {/* Accounts section */}
            <div>
              <AccessPanel
                channelId={channelId}
                channel={channel}
                slot="status-summary"
                selectedAccountId={accessAccountId}
                onSelectedAccountChange={setAccessAccountId}
                onActivateAccessTab={() => setActiveTab("access")}
              />

              {(alertCount > 0 || hasProbeAlert) && (
                <div
                  className="mb-3 rounded-md border px-3 py-2"
                  style={{
                    borderColor: "var(--destructive)",
                    backgroundColor: "var(--destructive-muted)",
                    color: "var(--destructive)",
                  }}
                >
                  <p className="text-xs font-semibold">{t("alerts.title")}</p>
                  {alertCount > 0 && (
                    <p className="mt-1 text-[11px]">{t("alerts.summary", { count: alertCount })}</p>
                  )}
                  {hasProbeAlert && <p className="mt-1 text-[11px]">{t("alerts.probeSummary")}</p>}
                </div>
              )}
              <label
                className="block text-xs font-medium mb-2"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t("diagnostics.title")}
              </label>
              <div
                className="mb-3 rounded-md border px-3 py-2 text-[11px]"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--muted)",
                  color: "var(--muted-foreground)",
                }}
              >
                {t("aggregateHealthNote")}
              </div>
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
                {channel.accounts.map((account) => {
                  const diagnostic = getAccountHealthDiagnostic(account);
                  const alert = getAccountHealthAlert(account);

                  return (
                    <div
                      key={account.accountId}
                      className="rounded-lg px-3 py-2 border"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: "var(--card)",
                      }}
                    >
                      {alert && (
                        <AccountAlertCard
                          severity={alert.severity}
                          title={`${t("alerts.accountTitle")} · ${t(`diagnostics.${alert.titleKey}`)}`}
                          description={t(`diagnostics.${alert.descriptionKey}`)}
                        />
                      )}

                      <AccountDiagnosticCard
                        tone={diagnostic.tone}
                        title={t(`diagnostics.${diagnostic.titleKey}`)}
                        description={t(`diagnostics.${diagnostic.descriptionKey}`)}
                        nextStep={`${t("diagnostics.nextStep")} · ${t(`diagnostics.${diagnostic.nextStepKey}`)}`}
                      />

                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="text-xs font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
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
                          <span className="break-all">
                            {t("diagnostics.lastError")}
                            {": "}
                            {account.lastError}
                          </span>
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
                        {accessDescriptor?.handleManageAccess ? (
                          <button
                            onClick={() =>
                              accessDescriptor.handleManageAccess?.(account.accountId, {
                                save: async (patch) => saveChannelConfig(channelId, patch),
                                refresh: async () => {
                                  await fetchChannelConfig(channelId);
                                },
                                openAccessTab: (accountId) =>
                                  openAccessTabWithAccount(accountId ?? account.accountId),
                              })
                            }
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded hover:opacity-80 transition-opacity"
                            style={{
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                              backgroundColor: "var(--background)",
                            }}
                          >
                            <Settings2 size={10} />
                            {t("access.manage")}
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfigAccount(account)}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded hover:opacity-80 transition-opacity"
                            style={{
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                              backgroundColor: "var(--background)",
                            }}
                          >
                            <Settings2 size={10} />
                            {t("accountConfig.configure")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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

        <TabsContent value="access" className="flex-1 overflow-y-auto">
          <ChannelAccessTab
            channelId={channelId}
            channel={channel}
            selectedAccountId={accessAccountId}
            onSelectedAccountChange={setAccessAccountId}
            onActivateAccessTab={() => setActiveTab("access")}
          />
        </TabsContent>

        {/* Bindings tab — filtered to this channel */}
        <TabsContent value="bindings" className="flex-1 overflow-hidden">
          <BindingsTab channelId={channelId} />
        </TabsContent>

        {/* Settings tab — DM policy, retry, channel-specific fields */}
        <TabsContent value="settings" className="flex-1 overflow-hidden">
          <ChannelSettingsTab channelId={channelId} />
        </TabsContent>

        {/* Analytics tab */}
        <TabsContent value="analytics" className="flex-1 overflow-y-auto">
          <ChannelAnalytics channelId={channelId} />
        </TabsContent>
      </Tabs>

      {/* Account config dialog */}
      {configAccount && !accessDescriptor?.usesAccessTabForAccountConfig && (
        <AccountConfigDialog
          open={!!configAccount}
          onOpenChange={(open) => {
            if (!open) {
              setConfigAccount(null);
            }
          }}
          channelId={channelId}
          account={configAccount}
        />
      )}
    </div>
  );
}
