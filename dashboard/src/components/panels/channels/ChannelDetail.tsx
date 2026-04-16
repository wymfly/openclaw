"use client";

import { LogOut, Power, PowerOff, AlertCircle, Settings2, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback, useEffect, useMemo } from "react";
import { navigateToPlugin } from "../../../lib/panel-navigation";
import { useChannelsStore, type ChannelAccount } from "../../../stores/channels";
import { useDeckRoutingStore } from "../../../stores/deck-routing";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";
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
import { buildWecomAccessModel } from "./wecom-access-model";

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

function formatAllowFromPreview(
  entries: string[],
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (entries.length === 0) {
    return t("permissionSummary.allowFromEmpty");
  }
  const preview = entries.slice(0, 3).join(", ");
  const extraCount = Math.max(entries.length - 3, 0);
  return t("permissionSummary.allowFromPreview", {
    preview,
    extra: extraCount > 0 ? ` (+${extraCount})` : "",
  });
}

type PermissionAlert = {
  message: string;
  accountId?: string;
  action: "access";
};

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
    channelConfig,
    fetchChannelConfig,
    pendingAccessTarget,
    setPendingAccessTarget,
  } = useChannelsStore();

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [configAccount, setConfigAccount] = useState<ChannelAccount | null>(null);
  const [activeTab, setActiveTab] = useState("status");
  const [accessAccountId, setAccessAccountId] = useState<string | undefined>(undefined);
  const [wecomConfigLoaded, setWecomConfigLoaded] = useState(channelId !== "wecom");
  const bindings = useDeckRoutingStore((state) => state.bindings);
  const fetchBindings = useDeckRoutingStore((state) => state.fetchBindings);
  const [bindingsLoaded, setBindingsLoaded] = useState(channelId !== "wecom");

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

  useEffect(() => {
    if (channelId !== "wecom") {
      setWecomConfigLoaded(true);
      return undefined;
    }

    let cancelled = false;
    setWecomConfigLoaded(false);
    void fetchChannelConfig(channelId).finally(() => {
      if (!cancelled) {
        setWecomConfigLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [channelId, fetchChannelConfig]);

  useEffect(() => {
    if (channelId !== "wecom") {
      setBindingsLoaded(true);
      return undefined;
    }

    let cancelled = false;
    setBindingsLoaded(false);
    void fetchBindings().finally(() => {
      if (!cancelled) {
        setBindingsLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [channelId, fetchBindings]);

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

  const shouldShowWecomSummary = channelId === "wecom" && wecomConfigLoaded;
  const wecomBindingCount = bindings.filter(
    (binding) => binding.match.channel === channelId,
  ).length;
  const wecomAccessModel = shouldShowWecomSummary
    ? buildWecomAccessModel(channel, channelConfig)
    : null;
  const wecomPermissionAlerts: PermissionAlert[] =
    wecomAccessModel === null
      ? []
      : [
          ...Object.entries(wecomAccessModel.accounts).flatMap(([accountId, accountState]) => {
            const alerts: PermissionAlert[] = [];
            if (
              accountState.botConfigured &&
              accountState.bot.policy === "allowlist" &&
              accountState.bot.allowFrom.length === 0
            ) {
              alerts.push({
                message: t("permissionSummary.botAllowlistEmpty", { account: accountId }),
                accountId,
                action: "access",
              });
            }
            if (
              accountState.agentConfigured &&
              accountState.agent.policy === "allowlist" &&
              accountState.agent.allowFrom.length === 0
            ) {
              alerts.push({
                message: t("permissionSummary.agentAllowlistEmpty", { account: accountId }),
                accountId,
                action: "access",
              });
            }
            return alerts;
          }),
          ...(wecomAccessModel.dynamicAgents.enabled &&
          wecomAccessModel.dynamicAgents.adminUsers.length === 0
            ? [
                {
                  message: t("permissionSummary.dynamicAgentsMissingAdmins"),
                  accountId: wecomAccessModel.defaultAccountId,
                  action: "access",
                } satisfies PermissionAlert,
              ]
            : []),
          ...(wecomAccessModel.dynamicAgents.enabled && bindingsLoaded && wecomBindingCount === 0
            ? [
                {
                  message: t("permissionSummary.dynamicAgentsMissingRouting"),
                  accountId: wecomAccessModel.defaultAccountId,
                  action: "access",
                } satisfies PermissionAlert,
              ]
            : []),
        ];

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
              {wecomAccessModel && (
                <div className="mb-4 space-y-3">
                  <label
                    className="block text-xs font-medium"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {t("permissionSummary.title")}
                  </label>

                  {wecomPermissionAlerts.length > 0 && (
                    <div className="space-y-2">
                      {wecomPermissionAlerts.map((alert) => (
                        <div
                          key={`${alert.action}:${alert.accountId ?? "global"}:${alert.message}`}
                          className="rounded-md border px-3 py-2 text-[11px]"
                          style={{
                            borderColor: "var(--warning)",
                            backgroundColor: "var(--warning-muted)",
                            color: "var(--warning-muted-text)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span>{alert.message}</span>
                            <button
                              type="button"
                              className="shrink-0 rounded border px-2 py-1 text-[10px] transition-opacity hover:opacity-80"
                              style={{
                                borderColor: "var(--warning)",
                                backgroundColor: "var(--background)",
                                color: "var(--foreground)",
                              }}
                              onClick={() => {
                                if (alert.action === "access") {
                                  setAccessAccountId(
                                    alert.accountId ?? wecomAccessModel.defaultAccountId,
                                  );
                                  setActiveTab("access");
                                }
                              }}
                            >
                              {t("permissionSummary.openAccess")}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    {wecomAccessModel.accountIds.map((accountId) => {
                      const accountState = wecomAccessModel.accounts[accountId];
                      const accountName =
                        channel.accounts.find((account) => account.accountId === accountId)?.name ??
                        accountId;

                      return (
                        <div
                          key={accountId}
                          className="rounded-lg border px-3 py-3"
                          style={{
                            borderColor: "var(--border)",
                            backgroundColor: "var(--card)",
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p
                                className="text-sm font-medium"
                                style={{ color: "var(--foreground)" }}
                              >
                                {accountName}
                              </p>
                              <p
                                className="text-[11px]"
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                {accountId}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setAccessAccountId(accountId);
                                setActiveTab("access");
                              }}
                              className="text-[10px] px-2 py-1 rounded border transition-opacity hover:opacity-80"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--foreground)",
                                backgroundColor: "var(--background)",
                              }}
                            >
                              {t("access.manage")}
                            </button>
                          </div>

                          <div className="mt-3 space-y-1 text-[11px]">
                            {accountState.botConfigured && (
                              <>
                                <p style={{ color: "var(--muted-foreground)" }}>
                                  {t("permissionSummary.botPolicy", {
                                    policy: t(`settings.dmPolicy.${accountState.bot.policy}`),
                                    count: accountState.bot.allowFrom.length,
                                  })}
                                </p>
                                <p style={{ color: "var(--text-tertiary)" }}>
                                  {formatAllowFromPreview(accountState.bot.allowFrom, t)}
                                </p>
                              </>
                            )}
                            {accountState.agentConfigured && (
                              <>
                                <p style={{ color: "var(--muted-foreground)" }}>
                                  {t("permissionSummary.agentPolicy", {
                                    policy: t(`settings.dmPolicy.${accountState.agent.policy}`),
                                    count: accountState.agent.allowFrom.length,
                                  })}
                                </p>
                                <p style={{ color: "var(--text-tertiary)" }}>
                                  {formatAllowFromPreview(accountState.agent.allowFrom, t)}
                                </p>
                              </>
                            )}
                            <p style={{ color: "var(--muted-foreground)" }}>
                              {t("permissionSummary.dynamicAgents", {
                                enabled: wecomAccessModel.dynamicAgents.enabled
                                  ? t("permissionSummary.enabled")
                                  : t("permissionSummary.disabled"),
                                admins: wecomAccessModel.dynamicAgents.adminUsers.length,
                              })}
                            </p>
                            <p style={{ color: "var(--muted-foreground)" }}>
                              {t("permissionSummary.routing", {
                                mode: wecomAccessModel.failClosedOnDefaultRoute
                                  ? t("permissionSummary.failClosed")
                                  : t("permissionSummary.fallback"),
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                        {channelId === "wecom" ? (
                          <button
                            onClick={() => {
                              setAccessAccountId(account.accountId);
                              setActiveTab("access");
                            }}
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
      {configAccount && channelId !== "wecom" && (
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
