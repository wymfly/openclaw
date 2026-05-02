import { useEffect, useMemo, useState } from "react";
import type { DeckGoChannelsStatusResponse } from "../../../../../contracts/generated/ts/deck-api.generated";
import type {
  DeckGoChannelThroughputBucket,
  DeckGoChannelTestResponse,
  DeckGoChannelThroughputResponse,
} from "../../../api";
import {
  fetchChannelThroughput,
  fetchChannels,
  logoutChannel,
  patchChannelConfig,
  testChannel,
} from "../../../api";
import { navigateToPlugin } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { AccountDmPolicyEditor } from "./AccountDmPolicyEditor";
import { ChannelSettingsEditor } from "./ChannelSettingsEditor";
import { WecomAccessControls, type WecomAccessAccount } from "./WecomAccessControls";

type PanelState = "idle" | "loading" | "ready";
type ChannelDiagnosticTone = "success" | "warning" | "error" | "neutral";
type ThroughputWindow = "1h" | "6h" | "24h";
type ChannelUiMeta = NonNullable<DeckGoChannelsStatusResponse["channelMeta"]>[number];
type ChannelTranslator = ReturnType<typeof useTranslations>;

const THROUGHPUT_WINDOWS: ThroughputWindow[] = ["1h", "6h", "24h"];

type NormalizedChannelAccount = {
  accountId: string;
  payload: Record<string, unknown>;
  diagnostic: {
    tone: ChannelDiagnosticTone;
    title: string;
    description: string;
    nextStep: string;
  };
};

function readChannelNavigationTarget() {
  if (typeof window === "undefined") {
    return { channelId: "", section: "" };
  }
  const params = new URL(window.location.href).searchParams;
  return {
    accountId: params.get("channelAccountId")?.trim() ?? "",
    channelId: params.get("channelId")?.trim() ?? "",
    section: params.get("channelSection") === "access" ? "access" : "",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function booleanValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function numberValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function accountDiagnostic(
  record: Record<string, unknown>,
  t: ChannelTranslator,
): NormalizedChannelAccount["diagnostic"] {
  const enabled = booleanValue(record, "enabled");
  const configured = booleanValue(record, "configured");
  const linked = booleanValue(record, "linked");
  const connected = booleanValue(record, "connected");
  const lastError = stringValue(record, "lastError");

  if (enabled === false) {
    return {
      tone: "neutral",
      title: t("diagDisabledTitle"),
      description: t("diagDisabledDescription"),
      nextStep: t("diagDisabledNextStep"),
    };
  }
  if (configured === false) {
    return {
      tone: "warning",
      title: t("diagConfigIncompleteTitle"),
      description: t("diagConfigIncompleteDescription"),
      nextStep: t("diagConfigIncompleteNextStep"),
    };
  }
  if (lastError) {
    return {
      tone: "error",
      title: t("diagAccountErrorTitle"),
      description: lastError,
      nextStep: t("diagAccountErrorNextStep"),
    };
  }
  if (linked === true && connected === false) {
    return {
      tone: "warning",
      title: t("diagLinkedDisconnectedTitle"),
      description: t("diagLinkedDisconnectedDescription"),
      nextStep: t("diagLinkedDisconnectedNextStep"),
    };
  }
  if (enabled === true && linked === false) {
    return {
      tone: "warning",
      title: t("diagEnabledNotLinkedTitle"),
      description: t("diagEnabledNotLinkedDescription"),
      nextStep: t("diagEnabledNotLinkedNextStep"),
    };
  }
  return {
    tone: "success",
    title: t("diagHealthyTitle"),
    description: t("diagHealthyDescription"),
    nextStep: t("diagHealthyNextStep"),
  };
}

function normalizeChannelAccounts(
  value: unknown,
  t: ChannelTranslator,
): NormalizedChannelAccount[] {
  const entries = Array.isArray(value)
    ? value.map((entry, index) => [`${index + 1}`, entry] as const)
    : Object.entries(asRecord(value));

  return entries.map(([fallbackId, entry]) => {
    const payload = asRecord(entry);
    const accountId = stringValue(payload, "accountId") || stringValue(payload, "id") || fallbackId;
    return {
      accountId,
      payload: { accountId, ...payload },
      diagnostic: accountDiagnostic(payload, t),
    };
  });
}

function countAlertingAccounts(accounts: NormalizedChannelAccount[]) {
  return accounts.filter(
    (account) => account.diagnostic.tone === "warning" || account.diagnostic.tone === "error",
  ).length;
}

function diagnosticClassName(tone: ChannelDiagnosticTone) {
  if (tone === "success") {
    return "is-positive";
  }
  if (tone === "warning") {
    return "is-warning";
  }
  if (tone === "error") {
    return "is-danger";
  }
  return "is-muted";
}

function formatBucketTime(time: number | undefined, window: ThroughputWindow, fallback: string) {
  if (typeof time !== "number") {
    return fallback;
  }
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  return window === "24h" ? `${hour}:00` : `${hour}:${minute}`;
}

function ChannelThroughputChart(props: {
  buckets: DeckGoChannelThroughputBucket[];
  window: ThroughputWindow;
  t: ChannelTranslator;
}) {
  const maxValue = Math.max(
    1,
    ...props.buckets.map((bucket) => Math.max(bucket.in ?? 0, bucket.out ?? 0)),
  );

  if (props.buckets.length === 0) {
    return (
      <p className="deckgo-note">{props.t("noThroughputBuckets", { window: props.window })}</p>
    );
  }

  return (
    <div
      className="deckgo-usage-chart deck-ui-channels-chart"
      data-testid="channel-throughput-chart"
    >
      {props.buckets.map((bucket, index) => {
        const messagesIn = bucket.in ?? 0;
        const messagesOut = bucket.out ?? 0;
        return (
          <div
            className="deckgo-usage-chart-row deck-ui-channels-chart-row"
            key={`${bucket.time ?? index}:${index}`}
          >
            <span className="deckgo-usage-chart-label">
              {formatBucketTime(bucket.time, props.window, props.t("bucket"))}
            </span>
            <span className="deckgo-usage-chart-track" aria-hidden="true">
              <progress
                className="deckgo-usage-chart-bar"
                max={100}
                value={Math.max(2, (messagesIn / maxValue) * 100)}
              />
              <progress
                className="deckgo-usage-chart-bar is-model"
                max={100}
                value={Math.max(2, (messagesOut / maxValue) * 100)}
              />
            </span>
            <span className="deckgo-usage-chart-value">
              {props.t("throughputInOut", { in: messagesIn, out: messagesOut })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function channelProbeTone(result: DeckGoChannelTestResponse) {
  if (result.ok === true) {
    return "is-positive";
  }
  if (/timeout|deadline/i.test(result.error ?? "")) {
    return "is-warning";
  }
  return "is-danger";
}

function channelProbeLabel(result: DeckGoChannelTestResponse, t: ChannelTranslator) {
  if (result.ok === true) {
    return t("probeSuccess");
  }
  if (/timeout|deadline/i.test(result.error ?? "")) {
    return t("probeTimeout");
  }
  return t("probeFailure");
}

function ChannelProbeResultBadge(props: {
  result: DeckGoChannelTestResponse;
  t: ChannelTranslator;
}) {
  return (
    <div className="deckgo-pill-row deck-ui-channels-status-row">
      <span className={`deckgo-pill ${channelProbeTone(props.result)}`}>
        {channelProbeLabel(props.result, props.t)}
      </span>
      {props.result.latencyMs != null ? (
        <span className="deckgo-pill">{props.result.latencyMs}ms</span>
      ) : null}
      {props.result.error ? (
        <span className="deckgo-pill is-muted">{props.result.error}</span>
      ) : null}
    </div>
  );
}

export function ChannelsPanel() {
  const t = useTranslations("channels");
  const ui = useDeckUI();
  const [navigationTarget] = useState(readChannelNavigationTarget);
  const [payload, setPayload] = useState<DeckGoChannelsStatusResponse | null>(null);
  const [throughput, setThroughput] = useState<DeckGoChannelThroughputResponse | null>(null);
  const [throughputWindow, setThroughputWindow] = useState<ThroughputWindow>("1h");
  const [channelTestResult, setChannelTestResult] = useState<DeckGoChannelTestResponse | null>(
    null,
  );
  const [configPatchResult, setConfigPatchResult] = useState<unknown>(null);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [throughputState, setThroughputState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "logging-out" | "testing" | "toggling">(
    "idle",
  );
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);

  const refresh = async (preferredChannelId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchChannels();
      setPayload(next);
      setLoadState("ready");
      setError("");
      const order = next.channelOrder?.length
        ? next.channelOrder
        : Object.keys(asRecord(next.channels));
      const fallbackId = preferredChannelId?.trim() || navigationTarget.channelId || order[0] || "";
      setSelectedChannelId((current) =>
        fallbackId && order.includes(fallbackId)
          ? fallbackId
          : current && order.includes(current)
            ? current
            : order[0] || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : t("loadChannelsFailed"));
    }
  };

  useEffect(() => {
    void refresh(navigationTarget.channelId);
  }, []);

  useEffect(() => {
    if (!selectedChannelId) {
      setThroughput(null);
      setThroughputState("idle");
      return undefined;
    }
    let mounted = true;
    setThroughputState("loading");
    void fetchChannelThroughput(selectedChannelId, throughputWindow)
      .then((next) => {
        if (!mounted) {
          return;
        }
        setThroughput(next);
        setThroughputState("ready");
      })
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setThroughput(null);
        setThroughputState("idle");
        setError(loadError instanceof Error ? loadError.message : t("throughputFetchFailed"));
      });
    return () => {
      mounted = false;
    };
  }, [selectedChannelId, throughputWindow]);

  const channelOrder = useMemo(
    () =>
      payload?.channelOrder?.length
        ? payload.channelOrder
        : Object.keys(asRecord(payload?.channels)),
    [payload],
  );
  const labels = payload?.channelLabels ?? {};
  const detailLabels = payload?.channelDetailLabels ?? {};
  const systemImages = payload?.channelSystemImages ?? {};
  const channelMetaById = useMemo(() => {
    const entries = Array.isArray(payload?.channelMeta) ? payload.channelMeta : [];
    return new Map(entries.map((entry: ChannelUiMeta) => [entry.id, entry]));
  }, [payload?.channelMeta]);
  const rawChannels = asRecord(payload?.channels);
  const rawChannelAccounts = asRecord(payload?.channelAccounts);
  const selectedChannel = selectedChannelId ? asRecord(rawChannels[selectedChannelId]) : {};
  const selectedChannelMeta = selectedChannelId
    ? channelMetaById.get(selectedChannelId)
    : undefined;
  const selectedAccounts = normalizeChannelAccounts(rawChannelAccounts[selectedChannelId], t);
  const selectedAccessAccounts: WecomAccessAccount[] = selectedAccounts.map((account) => ({
    accountId: account.accountId,
    label:
      stringValue(account.payload, "displayName") ||
      stringValue(account.payload, "name") ||
      account.accountId,
  }));
  const selectedDefaultAccountId = payload?.channelDefaultAccountId?.[selectedChannelId] || "";
  const selectedIsWecomAccessChannel =
    selectedChannelId === "wecom" || selectedChannelMeta?.pluginId === "wecom";
  const selectedChannelEnabled =
    booleanValue(selectedChannel, "enabled") ??
    selectedAccounts.some((account) => booleanValue(account.payload, "enabled") === true);
  const totalAccounts = Object.values(rawChannelAccounts).reduce((sum: number, value) => {
    return sum + normalizeChannelAccounts(value, t).length;
  }, 0);
  const throughputBuckets = Array.isArray(throughput?.buckets) ? throughput.buckets : [];
  const throughputMessagesIn = throughput?.messagesIn ?? 0;
  const throughputMessagesOut = throughput?.messagesOut ?? 0;
  const selectedProbeResult =
    channelTestResult?.channelId === selectedChannelId ? channelTestResult : null;
  const selectedChannelLatency =
    numberValue(selectedChannel, "latencyMs") ?? selectedProbeResult?.latencyMs;

  const runLogout = async () => {
    if (!selectedChannelId) {
      return;
    }
    if (!window.confirm(t("confirmLogoutChannel", { channelId: selectedChannelId }))) {
      return;
    }
    setActionState("logging-out");
    try {
      const result = await logoutChannel(selectedChannelId);
      setActionResult(result);
      setError("");
      await refresh(selectedChannelId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("logoutFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const runChannelTest = async () => {
    if (!selectedChannelId) {
      return;
    }
    setActionState("testing");
    try {
      const result = await testChannel(selectedChannelId);
      setChannelTestResult({ ...result, channelId: result.channelId || selectedChannelId });
      setError(result.ok === false ? result.error || t("testFailed") : "");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("testFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const toggleSelectedChannel = async () => {
    if (!selectedChannelId) {
      return;
    }
    const nextEnabled = !selectedChannelEnabled;
    if (
      !window.confirm(
        t("confirmSetChannelEnabled", {
          channelId: selectedChannelId,
          value: String(nextEnabled),
        }),
      )
    ) {
      return;
    }
    setActionState("toggling");
    try {
      const result = await patchChannelConfig(selectedChannelId, { enabled: nextEnabled });
      setConfigPatchResult(result);
      setError("");
      await refresh(selectedChannelId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("configPatchFailed"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-channels">
      <div className="deckgo-column deck-ui-channels-column">
        <article className="deckgo-card is-float deck-ui-channels-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("inventoryTitle")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("inventoryDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-channels-body">
            <div className="deckgo-pill-row deck-ui-channels-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                {t("inventoryStatus", { status: t(loadState) })}
              </span>
              <span className="deckgo-pill">
                {t("timestampValue", { value: payload?.ts ?? t("notAvailable") })}
              </span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-channels-stats">
              <ShellStat label={t("channelsStat")} value={channelOrder.length} />
              <ShellStat label={t("accountsStat")} value={totalAccounts} />
              <ShellStat
                label={t("defaultsStat")}
                value={Object.keys(payload?.channelDefaultAccountId ?? {}).length}
              />
            </div>
            <div className="deckgo-actions deck-ui-channels-actions">
              <button
                className="deckgo-button deck-ui-channels-button"
                type="button"
                onClick={() => void refresh(selectedChannelId)}
              >
                {t("refreshChannels")}
              </button>
              <button
                className="deckgo-button deck-ui-channels-button"
                type="button"
                onClick={() => void runLogout()}
                disabled={!selectedChannelId || actionState !== "idle"}
              >
                {actionState === "logging-out" ? t("loggingOut") : t("logoutChannel")}
              </button>
              <button
                className="deckgo-button deck-ui-channels-button"
                type="button"
                onClick={() => void runChannelTest()}
                disabled={!selectedChannelId || actionState !== "idle"}
              >
                {actionState === "testing" ? t("testingChannel") : t("testChannel")}
              </button>
              <button
                className="deckgo-button deck-ui-channels-button"
                type="button"
                onClick={() => void toggleSelectedChannel()}
                disabled={!selectedChannelId || actionState !== "idle"}
              >
                {actionState === "toggling"
                  ? t("savingConfig")
                  : selectedChannelEnabled
                    ? t("disableChannel")
                    : t("enableChannel")}
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-channels-error">{error}</p> : null}
            {channelOrder.length === 0 ? (
              <p className="deckgo-note deck-ui-channels-empty">{t("noChannelsLoaded")}</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-channels-list">
                {channelOrder.map((channelId) => {
                  const channelAccounts = normalizeChannelAccounts(
                    rawChannelAccounts[channelId],
                    t,
                  );
                  const alertCount = countAlertingAccounts(channelAccounts);
                  const channelMeta = channelMetaById.get(channelId);
                  return (
                    <li key={channelId}>
                      <button
                        type="button"
                        className={`deckgo-selectable-card deck-ui-channels-row ${selectedChannelId === channelId ? "is-selected" : ""}`}
                        onClick={() => {
                          setSelectedChannelId(channelId);
                          setError("");
                        }}
                      >
                        <strong>{labels[channelId] || channelId}</strong>
                        <div className="deckgo-meta">
                          {t("channelRowMeta", {
                            channelId,
                            detail:
                              channelMeta?.detailLabel ||
                              detailLabels[channelId] ||
                              t("notAvailable"),
                            account:
                              payload?.channelDefaultAccountId?.[channelId] || t("notAvailable"),
                          })}
                        </div>
                        <div className="deckgo-meta">
                          {t("channelRowStats", {
                            accounts: channelAccounts.length,
                            alerts: alertCount,
                            plugin: channelMeta?.pluginId
                              ? t("pluginSuffix", { plugin: channelMeta.pluginId })
                              : "",
                          })}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-channels-column">
        <article className="deckgo-card is-float deck-ui-channels-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("selectedChannel")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("selectedChannelDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-channels-body">
            {selectedChannelId ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-channels-hero">
                  <div>
                    <p className="deckgo-kicker">{t("channelKicker")}</p>
                    <strong>{labels[selectedChannelId] || selectedChannelId}</strong>
                    <p className="deckgo-note">
                      {t("selectedChannelNote", {
                        detail:
                          selectedChannelMeta?.detailLabel ||
                          detailLabels[selectedChannelId] ||
                          t("notAvailable"),
                        account: selectedDefaultAccountId || t("notAvailable"),
                      })}
                    </p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-channels-status-row">
                    <span className="deckgo-pill">
                      {t("accountsBadge", { count: selectedAccounts.length })}
                    </span>
                    <span
                      className={`deckgo-pill ${selectedChannelEnabled ? "is-positive" : "is-muted"}`}
                    >
                      {selectedChannelEnabled ? t("enabled") : t("disabled")}
                    </span>
                    <span
                      className={`deckgo-pill ${
                        countAlertingAccounts(selectedAccounts) > 0 ? "is-warning" : "is-positive"
                      }`}
                    >
                      {t("alertsBadge", { count: countAlertingAccounts(selectedAccounts) })}
                    </span>
                    <span className="deckgo-pill">
                      {t("channelIdBadge", { channelId: selectedChannelId })}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-channels-detail-stats">
                  <ShellStat
                    label={t("labelStat")}
                    value={labels[selectedChannelId] || selectedChannelId}
                  />
                  <ShellStat
                    label={t("detailLabelStat")}
                    value={
                      selectedChannelMeta?.detailLabel ||
                      detailLabels[selectedChannelId] ||
                      t("notAvailable")
                    }
                  />
                  <ShellStat
                    label={t("systemImageStat")}
                    value={
                      selectedChannelMeta?.systemImage ||
                      systemImages[selectedChannelId] ||
                      t("notAvailable")
                    }
                  />
                  <ShellStat
                    label={t("pluginStat")}
                    value={selectedChannelMeta?.pluginId || t("notAvailable")}
                  />
                  <ShellStat
                    label={t("pluginOriginStat")}
                    value={selectedChannelMeta?.pluginOrigin || t("notAvailable")}
                  />
                  <ShellStat
                    label={t("pluginConfigStat")}
                    value={selectedChannelMeta?.pluginConfigPath || t("notAvailable")}
                  />
                  <ShellStat
                    label={t("defaultAccountStat")}
                    value={selectedDefaultAccountId || t("notAvailable")}
                  />
                  <ShellStat label={t("messagesInStat")} value={throughputMessagesIn} />
                  <ShellStat label={t("messagesOutStat")} value={throughputMessagesOut} />
                  <ShellStat label={t("throughputBucketsStat")} value={throughputBuckets.length} />
                  <ShellStat
                    label={t("probeLatencyStat")}
                    value={
                      selectedChannelLatency != null
                        ? `${selectedChannelLatency}ms`
                        : t("notAvailable")
                    }
                  />
                </div>
                {selectedChannelMeta?.pluginId ? (
                  <div className="deckgo-actions deck-ui-channels-actions deck-ui-channels-actions-offset">
                    <button
                      className="deckgo-button deck-ui-channels-button"
                      type="button"
                      onClick={() => navigateToPlugin(ui, selectedChannelMeta.pluginId)}
                    >
                      {t("openChannelPlugin")}
                    </button>
                  </div>
                ) : null}
                <div className="deckgo-surface-tile deck-ui-channels-surface">
                  <p className="deckgo-surface-label">{t("providerOnboardingTitle")}</p>
                  <p className="deckgo-note">{t("providerOnboardingUnavailable")}</p>
                </div>
                <div className="deckgo-surface-tile deck-ui-channels-surface">
                  <div className="deckgo-card-header deck-ui-channels-surface-head">
                    <div>
                      <p className="deckgo-surface-label">{t("throughput")}</p>
                      <p className="deckgo-note">
                        {t("throughputStatus", { status: t(throughputState) })}
                      </p>
                    </div>
                    <div className="deckgo-actions deck-ui-channels-actions">
                      {THROUGHPUT_WINDOWS.map((window) => (
                        <button
                          className={`deckgo-button deck-ui-channels-button ${
                            throughputWindow === window ? "is-primary" : ""
                          }`}
                          key={window}
                          type="button"
                          onClick={() => setThroughputWindow(window)}
                        >
                          {window}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ChannelThroughputChart
                    buckets={throughputBuckets}
                    window={throughputWindow}
                    t={t}
                  />
                </div>
                {selectedProbeResult ? (
                  <div className="deckgo-surface-tile deck-ui-channels-surface">
                    <p className="deckgo-surface-label">{t("probeResult")}</p>
                    <ChannelProbeResultBadge result={selectedProbeResult} t={t} />
                  </div>
                ) : null}
                {!selectedIsWecomAccessChannel ? (
                  <ChannelSettingsEditor
                    channelId={selectedChannelId}
                    channel={selectedChannel}
                    onSaved={async (result) => {
                      setConfigPatchResult(result);
                      await refresh(selectedChannelId);
                    }}
                  />
                ) : null}
                {selectedAccounts.length > 0 ? (
                  <ul className="deckgo-shell-list deck-ui-channels-list">
                    {selectedAccounts.map((account) => (
                      <li key={account.accountId}>
                        <div className="deckgo-selectable-card deck-ui-channels-account-card">
                          <div className="deckgo-card-header deck-ui-channels-surface-head">
                            <div>
                              <strong>
                                {stringValue(account.payload, "displayName") ||
                                  stringValue(account.payload, "name") ||
                                  account.accountId}
                              </strong>
                              <div className="deckgo-meta">{account.accountId}</div>
                            </div>
                            <span
                              className={`deckgo-pill ${diagnosticClassName(
                                account.diagnostic.tone,
                              )}`}
                            >
                              {account.diagnostic.title}
                            </span>
                          </div>
                          <p className="deckgo-note">{account.diagnostic.description}</p>
                          <p className="deckgo-note">
                            {t("nextStep", { step: account.diagnostic.nextStep })}
                          </p>
                          {!selectedIsWecomAccessChannel ? (
                            <AccountDmPolicyEditor
                              channelId={selectedChannelId}
                              accountId={account.accountId}
                              accountPayload={account.payload}
                              onSaved={async (result) => {
                                setConfigPatchResult(result);
                                await refresh(selectedChannelId);
                              }}
                            />
                          ) : null}
                          <div className="deckgo-meta">{JSON.stringify(account.payload)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="deckgo-note">{t("noChannelAccounts")}</p>
                )}
                <JsonDetails title={t("channelMetadata")} payload={selectedChannelMeta ?? null} />
                {selectedIsWecomAccessChannel ? (
                  <WecomAccessControls
                    channelId={selectedChannelId}
                    accounts={selectedAccessAccounts}
                    defaultAccountId={selectedDefaultAccountId}
                    initialAccountId={navigationTarget.accountId}
                    initialFocus={navigationTarget.section === "access" ? "access" : undefined}
                    onSaved={() => refresh(selectedChannelId)}
                  />
                ) : null}
                <JsonDetails title={t("channelPayload")} payload={selectedChannel} />
                <JsonDetails title={t("channelTestResult")} payload={selectedProbeResult} />
                <JsonDetails title={t("channelConfigPatchResult")} payload={configPatchResult} />
                <JsonDetails title={t("logoutResult")} payload={actionResult} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-channels-empty">{t("chooseChannel")}</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
