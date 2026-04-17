"use client";

import { AlertCircle, ArrowUpRight, Bot, Route } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { navigateToRouting } from "@/lib/panel-navigation";
import { useChannelsStore, type ChannelInfo } from "@/stores/channels";
import { useDeckRoutingStore } from "@/stores/deck-routing";
import { Button } from "../../../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select";
import { AllowFromEditor } from "../AllowFromEditor";
import { DmPolicySelector } from "../DmPolicySelector";
import {
  buildWecomAccessModel,
  normalizeWecomAllowFromEntry,
  type DmPolicy,
  type WecomDmState,
} from "../wecom-access-model";
import { registerAccessDescriptor } from "./access-descriptor-registry";
import type { AccessDescriptor, AccessLoadContext } from "./access-descriptor.types";

function SectionAlert({ message }: { message: string }) {
  return (
    <div
      className="mb-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[11px]"
      style={{
        borderColor: "var(--warning)",
        backgroundColor: "var(--warning-muted)",
        color: "var(--warning-muted-text)",
      }}
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SaveBar({
  disabled,
  saving,
  onSave,
}: {
  disabled: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const tc = useTranslations("common");
  return (
    <div className="mt-3 flex justify-end">
      <Button size="sm" disabled={disabled || saving} onClick={onSave}>
        {saving ? tc("saving") : tc("save")}
      </Button>
    </div>
  );
}

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

function WecomAccessTabContent({
  channel,
  selectedAccountId: controlledSelectedAccountId,
  onSelectedAccountChange,
}: {
  channel: ChannelInfo;
  selectedAccountId?: string;
  onSelectedAccountChange?: (accountId: string) => void;
}) {
  const t = useTranslations("channels.access");
  const tc = useTranslations("common");
  const {
    channelConfig,
    fetchChannelConfig,
    saveChannelConfig,
    channelConfigSaveError,
    fetchChannels,
  } = useChannelsStore();
  const bindings = useDeckRoutingStore((state) => state.bindings);
  const fetchBindings = useDeckRoutingStore((state) => state.fetchBindings);

  const [loaded, setLoaded] = useState(false);
  const [bindingsLoaded, setBindingsLoaded] = useState(false);
  const accessModel = useMemo(
    () => buildWecomAccessModel(channel, channelConfig),
    [channel, channelConfig],
  );
  const [uncontrolledSelectedAccountId, setUncontrolledSelectedAccountId] = useState(
    accessModel.defaultAccountId,
  );
  const [botDm, setBotDm] = useState<WecomDmState>({ policy: "pairing", allowFrom: [] });
  const [agentDm, setAgentDm] = useState<WecomDmState>({ policy: "pairing", allowFrom: [] });
  const [dynamicAgents, setDynamicAgents] = useState(accessModel.dynamicAgents);
  const [failClosed, setFailClosed] = useState(accessModel.failClosedOnDefaultRoute);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const selectedAccountId = controlledSelectedAccountId ?? uncontrolledSelectedAccountId;

  useEffect(() => {
    setLoaded(false);
    void fetchChannelConfig(channel.id).then(() => setLoaded(true));
  }, [channel.id, fetchChannelConfig]);

  useEffect(() => {
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
  }, [fetchBindings]);

  useEffect(() => {
    if (
      controlledSelectedAccountId &&
      controlledSelectedAccountId !== uncontrolledSelectedAccountId
    ) {
      setUncontrolledSelectedAccountId(controlledSelectedAccountId);
    }
  }, [controlledSelectedAccountId, uncontrolledSelectedAccountId]);

  useEffect(() => {
    if (!accessModel.accountIds.includes(selectedAccountId)) {
      if (controlledSelectedAccountId !== undefined) {
        onSelectedAccountChange?.(accessModel.defaultAccountId);
      } else {
        setUncontrolledSelectedAccountId(accessModel.defaultAccountId);
      }
    }
  }, [
    accessModel.accountIds,
    accessModel.defaultAccountId,
    controlledSelectedAccountId,
    onSelectedAccountChange,
    selectedAccountId,
  ]);

  useEffect(() => {
    const selected =
      accessModel.accounts[selectedAccountId] ?? accessModel.accounts[accessModel.defaultAccountId];
    setBotDm(selected?.bot ?? { policy: "pairing", allowFrom: [] });
    setAgentDm(selected?.agent ?? { policy: "pairing", allowFrom: [] });
    setDynamicAgents(accessModel.dynamicAgents);
    setFailClosed(accessModel.failClosedOnDefaultRoute);
  }, [
    accessModel.accounts,
    accessModel.defaultAccountId,
    accessModel.dynamicAgents,
    accessModel.failClosedOnDefaultRoute,
    selectedAccountId,
  ]);

  const routingBindingCount = bindings.filter((binding) => {
    if (binding.match.channel !== channel.id) {
      return false;
    }
    const bindingAccountId = binding.match.accountId;
    if (!selectedAccountId) {
      return true;
    }
    return !bindingAccountId || bindingAccountId === selectedAccountId;
  }).length;
  const shouldWarnMissingRouting =
    dynamicAgents.enabled && bindingsLoaded && routingBindingCount === 0;

  const selectedAccount =
    accessModel.accounts[selectedAccountId] ?? accessModel.accounts[accessModel.defaultAccountId];
  const accountLabel =
    channel.accounts.find((account) => account.accountId === selectedAccountId)?.name ??
    selectedAccountId;

  const savePatch = useCallback(
    async (patch: Record<string, unknown>, section: string) => {
      setSavingSection(section);
      try {
        const ok = await saveChannelConfig(channel.id, patch);
        if (ok) {
          await fetchChannels();
        }
      } finally {
        setSavingSection(null);
      }
    },
    [channel.id, fetchChannels, saveChannelConfig],
  );

  const saveDmScope = useCallback(
    async (scope: "bot" | "agent", dm: WecomDmState) => {
      const modePatch = {
        [scope]: {
          dm: {
            policy: dm.policy,
            allowFrom: dm.allowFrom,
          },
        },
      };
      const patch = accessModel.isMatrix
        ? { accounts: { [selectedAccountId]: modePatch } }
        : modePatch;
      await savePatch(patch, scope);
    },
    [accessModel.isMatrix, savePatch, selectedAccountId],
  );

  const saveDynamicAgents = useCallback(async () => {
    await savePatch(
      {
        dynamicAgents: {
          enabled: dynamicAgents.enabled,
          dmCreateAgent: dynamicAgents.dmCreateAgent,
          groupEnabled: dynamicAgents.groupEnabled,
          adminUsers: dynamicAgents.adminUsers,
        },
      },
      "dynamicAgents",
    );
  }, [dynamicAgents, savePatch]);

  const saveRoutingBehavior = useCallback(async () => {
    await savePatch({ routing: { failClosedOnDefaultRoute: failClosed } }, "routing");
  }, [failClosed, savePatch]);

  const initialBot = selectedAccount?.bot ?? { policy: "pairing", allowFrom: [] };
  const initialAgent = selectedAccount?.agent ?? { policy: "pairing", allowFrom: [] };
  const botDirty = JSON.stringify(botDm) !== JSON.stringify(initialBot);
  const agentDirty = JSON.stringify(agentDm) !== JSON.stringify(initialAgent);
  const dynamicDirty = JSON.stringify(dynamicAgents) !== JSON.stringify(accessModel.dynamicAgents);
  const routingDirty = failClosed !== accessModel.failClosedOnDefaultRoute;

  if (!loaded) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
        {tc("loading")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <div
          className="rounded-lg border px-4 py-3"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {t("title")}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("description")}
          </p>
        </div>

        {accessModel.accountIds.length > 1 && (
          <>
            <div
              className="rounded-lg border px-4 py-3"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
            >
              <label
                className="mb-2 block text-xs font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t("accountSelector")}
              </label>
              <Select
                value={selectedAccountId}
                onValueChange={(value) => {
                  if (!value) {
                    return;
                  }
                  if (controlledSelectedAccountId !== undefined) {
                    onSelectedAccountChange?.(value);
                  } else {
                    setUncontrolledSelectedAccountId(value);
                  }
                }}
              >
                <SelectTrigger className="w-full max-w-sm cursor-pointer border-[var(--border)] bg-[var(--background)] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accessModel.accountIds.map((accountId) => {
                    const name =
                      channel.accounts.find((account) => account.accountId === accountId)?.name ??
                      accountId;
                    return (
                      <SelectItem key={accountId} value={accountId}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div
              className="rounded-lg border px-4 py-3"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {t("allAccountsTitle")}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {t("allAccountsDescription")}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr style={{ color: "var(--muted-foreground)" }}>
                      <th className="pb-2 pr-4 text-left font-medium">{t("table.account")}</th>
                      <th className="pb-2 pr-4 text-left font-medium">{t("table.bot")}</th>
                      <th className="pb-2 pr-4 text-left font-medium">{t("table.agent")}</th>
                      <th className="pb-2 text-left font-medium">{t("table.dynamicAgents")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessModel.accountIds.map((accountId) => {
                      const accountState = accessModel.accounts[accountId];
                      const accountName =
                        channel.accounts.find((account) => account.accountId === accountId)?.name ??
                        accountId;
                      const isSelected = accountId === selectedAccountId;
                      return (
                        <tr
                          key={accountId}
                          onClick={() => {
                            if (controlledSelectedAccountId !== undefined) {
                              onSelectedAccountChange?.(accountId);
                            } else {
                              setUncontrolledSelectedAccountId(accountId);
                            }
                          }}
                          className="cursor-pointer border-t"
                          style={{ borderColor: "var(--border-subtle)" }}
                        >
                          <td
                            className="py-2 pr-4 font-medium"
                            style={{ color: isSelected ? "var(--primary)" : "var(--foreground)" }}
                          >
                            {accountName}
                          </td>
                          <td className="py-2 pr-4" style={{ color: "var(--muted-foreground)" }}>
                            {accountState.botConfigured
                              ? t(`dmPolicy.${accountState.bot.policy}`)
                              : t("table.notConfigured")}
                          </td>
                          <td className="py-2 pr-4" style={{ color: "var(--muted-foreground)" }}>
                            {accountState.agentConfigured
                              ? t(`dmPolicy.${accountState.agent.policy}`)
                              : t("table.notConfigured")}
                          </td>
                          <td className="py-2" style={{ color: "var(--muted-foreground)" }}>
                            {accessModel.dynamicAgents.enabled
                              ? t("table.enabled")
                              : t("table.disabled")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {selectedAccount?.botConfigured && (
          <div
            className="rounded-lg border px-4 py-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
          >
            <div className="flex items-center gap-2">
              <Bot size={14} style={{ color: "var(--primary)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {t("botSection", { account: accountLabel })}
              </p>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {t("botDescription")}
            </p>
            {botDm.policy === "allowlist" && botDm.allowFrom.length === 0 && (
              <SectionAlert message={t("allowlistEmpty")} />
            )}
            <div className="mt-3 space-y-3">
              <DmPolicySelector
                value={botDm.policy}
                onChange={(policy) => setBotDm((prev) => ({ ...prev, policy: policy as DmPolicy }))}
              />
              {botDm.policy === "allowlist" && (
                <AllowFromEditor
                  entries={botDm.allowFrom}
                  onChange={(allowFrom) => setBotDm((prev) => ({ ...prev, allowFrom }))}
                  formatHint={t("allowFromHint")}
                  normalize={normalizeWecomAllowFromEntry}
                  placeholder={t("allowFromPlaceholder")}
                />
              )}
            </div>
            <SaveBar
              disabled={!botDirty}
              saving={savingSection === "bot"}
              onSave={() => void saveDmScope("bot", botDm)}
            />
          </div>
        )}

        {selectedAccount?.agentConfigured && (
          <div
            className="rounded-lg border px-4 py-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
          >
            <div className="flex items-center gap-2">
              <Route size={14} style={{ color: "var(--primary)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {t("agentSection", { account: accountLabel })}
              </p>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {t("agentDescription")}
            </p>
            {agentDm.policy === "allowlist" && agentDm.allowFrom.length === 0 && (
              <SectionAlert message={t("allowlistEmpty")} />
            )}
            <div className="mt-3 space-y-3">
              <DmPolicySelector
                value={agentDm.policy}
                onChange={(policy) =>
                  setAgentDm((prev) => ({ ...prev, policy: policy as DmPolicy }))
                }
              />
              {agentDm.policy === "allowlist" && (
                <AllowFromEditor
                  entries={agentDm.allowFrom}
                  onChange={(allowFrom) => setAgentDm((prev) => ({ ...prev, allowFrom }))}
                  formatHint={t("allowFromHint")}
                  normalize={normalizeWecomAllowFromEntry}
                  placeholder={t("allowFromPlaceholder")}
                />
              )}
            </div>
            <SaveBar
              disabled={!agentDirty}
              saving={savingSection === "agent"}
              onSave={() => void saveDmScope("agent", agentDm)}
            />
          </div>
        )}

        {!selectedAccount?.botConfigured && !selectedAccount?.agentConfigured && (
          <div
            className="rounded-lg border px-4 py-3 text-xs"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--muted-foreground)",
            }}
          >
            {t("noModes")}
          </div>
        )}

        <div
          className="rounded-lg border px-4 py-3"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {t("dynamicAgentsTitle")}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("dynamicAgentsDescription")}
          </p>
          {dynamicAgents.enabled && dynamicAgents.adminUsers.length === 0 && (
            <SectionAlert message={t("dynamicAgentsMissingAdmins")} />
          )}
          {shouldWarnMissingRouting && (
            <SectionAlert message={t("dynamicAgentsMissingRouting", { account: accountLabel })} />
          )}
          <div className="mt-3 space-y-3 text-xs">
            <label className="flex items-center justify-between gap-3">
              <span>{t("dynamicAgentsEnabled")}</span>
              <input
                type="checkbox"
                checked={dynamicAgents.enabled}
                onChange={(event) =>
                  setDynamicAgents((prev) => ({ ...prev, enabled: event.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>{t("dynamicAgentsDm")}</span>
              <input
                type="checkbox"
                checked={dynamicAgents.dmCreateAgent}
                onChange={(event) =>
                  setDynamicAgents((prev) => ({ ...prev, dmCreateAgent: event.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>{t("dynamicAgentsGroup")}</span>
              <input
                type="checkbox"
                checked={dynamicAgents.groupEnabled}
                onChange={(event) =>
                  setDynamicAgents((prev) => ({ ...prev, groupEnabled: event.target.checked }))
                }
              />
            </label>
            <AllowFromEditor
              entries={dynamicAgents.adminUsers}
              onChange={(adminUsers) => setDynamicAgents((prev) => ({ ...prev, adminUsers }))}
              formatHint={t("adminUsersHint")}
              normalize={normalizeWecomAllowFromEntry}
              placeholder={t("adminUsersPlaceholder")}
            />
          </div>
          <SaveBar
            disabled={!dynamicDirty}
            saving={savingSection === "dynamicAgents"}
            onSave={() => void saveDynamicAgents()}
          />
        </div>

        <div
          className="rounded-lg border px-4 py-3"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {t("routingTitle")}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("routingDescription")}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span>{t("failClosedLabel")}</span>
            <input
              type="checkbox"
              checked={failClosed}
              onChange={(event) => setFailClosed(event.target.checked)}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() =>
                navigateToRouting({
                  channelId: channel.id,
                  accountId: selectedAccountId,
                })
              }
            >
              <ArrowUpRight size={12} />
              {t("openRouting")}
            </Button>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {t("routingSummary")}
            </span>
          </div>
          <SaveBar
            disabled={!routingDirty}
            saving={savingSection === "routing"}
            onSave={() => void saveRoutingBehavior()}
          />
        </div>
      </div>

      {channelConfigSaveError && (
        <div className="shrink-0 px-4 py-2">
          <p className="text-xs" style={{ color: "var(--destructive)" }}>
            {channelConfigSaveError}
          </p>
        </div>
      )}
    </div>
  );
}

type PermissionAlert = {
  message: string;
  accountId?: string;
  action: "access";
};

function WecomPermissionSummary({
  channel,
  onOpenAccess,
}: {
  channel: ChannelInfo;
  onOpenAccess: (accountId: string) => void;
}) {
  const t = useTranslations("channels");
  const { channelConfig, fetchChannelConfig } = useChannelsStore();
  const bindings = useDeckRoutingStore((state) => state.bindings);
  const fetchBindings = useDeckRoutingStore((state) => state.fetchBindings);
  const [wecomConfigLoaded, setWecomConfigLoaded] = useState(false);
  const [bindingsLoaded, setBindingsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setWecomConfigLoaded(false);
    void fetchChannelConfig(channel.id).finally(() => {
      if (!cancelled) {
        setWecomConfigLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [channel.id, fetchChannelConfig]);

  useEffect(() => {
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
  }, [fetchBindings]);

  if (!wecomConfigLoaded) {
    return null;
  }

  const wecomBindingCount = bindings.filter(
    (binding) => binding.match.channel === channel.id,
  ).length;
  const accessModel = buildWecomAccessModel(channel, channelConfig);
  const permissionAlerts: PermissionAlert[] = [
    ...Object.entries(accessModel.accounts).flatMap(([accountId, accountState]) => {
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
    ...(accessModel.dynamicAgents.enabled && accessModel.dynamicAgents.adminUsers.length === 0
      ? [
          {
            message: t("permissionSummary.dynamicAgentsMissingAdmins"),
            accountId: accessModel.defaultAccountId,
            action: "access",
          } satisfies PermissionAlert,
        ]
      : []),
    ...(accessModel.dynamicAgents.enabled && bindingsLoaded && wecomBindingCount === 0
      ? [
          {
            message: t("permissionSummary.dynamicAgentsMissingRouting"),
            accountId: accessModel.defaultAccountId,
            action: "access",
          } satisfies PermissionAlert,
        ]
      : []),
  ];

  return (
    <div className="mb-4 space-y-3">
      <label className="block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
        {t("permissionSummary.title")}
      </label>

      {permissionAlerts.length > 0 && (
        <div className="space-y-2">
          {permissionAlerts.map((alert) => (
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
                      onOpenAccess(alert.accountId ?? accessModel.defaultAccountId);
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
        {accessModel.accountIds.map((accountId) => {
          const accountState = accessModel.accounts[accountId];
          const accountName =
            channel.accounts.find((account) => account.accountId === accountId)?.name ?? accountId;

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
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {accountName}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {accountId}
                  </p>
                </div>
                <button
                  onClick={() => onOpenAccess(accountId)}
                  className="rounded border px-2 py-1 text-[10px] transition-opacity hover:opacity-80"
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
                    enabled: accessModel.dynamicAgents.enabled
                      ? t("permissionSummary.enabled")
                      : t("permissionSummary.disabled"),
                    admins: accessModel.dynamicAgents.adminUsers.length,
                  })}
                </p>
                <p style={{ color: "var(--muted-foreground)" }}>
                  {t("permissionSummary.routing", {
                    mode: accessModel.failClosedOnDefaultRoute
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
  );
}

export const WECOM_ACCESS_EXCLUDE_PATHS: readonly string[] = [
  "bot.dm",
  "agent.dm",
  "dynamicAgents",
  "routing.failClosedOnDefaultRoute",
  "accounts.*.bot.dm",
  "accounts.*.agent.dm",
];

export const wecomAccessDescriptor: AccessDescriptor<null> = {
  channelId: "wecom",

  async load(_context: AccessLoadContext): Promise<null> {
    return null;
  },

  render(context) {
    if (!context.channel) {
      return <></>;
    }
    return (
      <WecomAccessTabContent
        channel={context.channel}
        selectedAccountId={context.selectedAccountId}
        onSelectedAccountChange={context.onSelectedAccountChange}
      />
    );
  },

  renderStatusSummary(context) {
    if (!context.channel) {
      return null;
    }
    return (
      <WecomPermissionSummary
        channel={context.channel}
        onOpenAccess={(accountId) => context.actions.openAccessTab(accountId)}
      />
    );
  },

  settingsExcludePaths: WECOM_ACCESS_EXCLUDE_PATHS,

  usesAccessTabForAccountConfig: true,

  handleManageAccess(accountId, actions) {
    actions.openAccessTab(accountId);
  },
};

registerAccessDescriptor(wecomAccessDescriptor as AccessDescriptor, {
  allowReplace: process.env.NODE_ENV !== "production",
});
