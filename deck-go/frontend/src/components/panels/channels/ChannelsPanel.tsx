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
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { AccountDmPolicyEditor } from "./AccountDmPolicyEditor";
import { ChannelSettingsEditor } from "./ChannelSettingsEditor";
import { WecomAccessControls, type WecomAccessAccount } from "./WecomAccessControls";

type PanelState = "idle" | "loading" | "ready";
type ChannelDiagnosticTone = "success" | "warning" | "error" | "neutral";
type ThroughputWindow = "1h" | "6h" | "24h";
type ChannelUiMeta = NonNullable<DeckGoChannelsStatusResponse["channelMeta"]>[number];

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
): NormalizedChannelAccount["diagnostic"] {
  const enabled = booleanValue(record, "enabled");
  const configured = booleanValue(record, "configured");
  const linked = booleanValue(record, "linked");
  const connected = booleanValue(record, "connected");
  const lastError = stringValue(record, "lastError");

  if (enabled === false) {
    return {
      tone: "neutral",
      title: "disabled",
      description: "This account is disabled in channel configuration.",
      nextStep: "Enable it before expecting runtime delivery.",
    };
  }
  if (configured === false) {
    return {
      tone: "warning",
      title: "config incomplete",
      description: "Required channel configuration is incomplete.",
      nextStep: "Open the raw channel config or schema-guided settings before reconnecting.",
    };
  }
  if (lastError) {
    return {
      tone: "error",
      title: "account error",
      description: lastError,
      nextStep: "Inspect the channel runtime error and refresh after remediation.",
    };
  }
  if (linked === true && connected === false) {
    return {
      tone: "warning",
      title: "linked disconnected",
      description: "The account is linked but not connected.",
      nextStep: "Retry login or check the channel runtime process.",
    };
  }
  if (enabled === true && linked === false) {
    return {
      tone: "warning",
      title: "enabled not linked",
      description: "The account is enabled but has not completed linking.",
      nextStep: "Start the channel login flow for this account.",
    };
  }
  return {
    tone: "success",
    title: "healthy",
    description: "No account-level health issue is reported.",
    nextStep: "No action needed.",
  };
}

function normalizeChannelAccounts(value: unknown): NormalizedChannelAccount[] {
  const entries = Array.isArray(value)
    ? value.map((entry, index) => [`${index + 1}`, entry] as const)
    : Object.entries(asRecord(value));

  return entries.map(([fallbackId, entry]) => {
    const payload = asRecord(entry);
    const accountId = stringValue(payload, "accountId") || stringValue(payload, "id") || fallbackId;
    return {
      accountId,
      payload: { accountId, ...payload },
      diagnostic: accountDiagnostic(payload),
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

function formatBucketTime(time: number | undefined, window: ThroughputWindow) {
  if (typeof time !== "number") {
    return "bucket";
  }
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) {
    return "bucket";
  }
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  return window === "24h" ? `${hour}:00` : `${hour}:${minute}`;
}

function ChannelThroughputChart(props: {
  buckets: DeckGoChannelThroughputBucket[];
  window: ThroughputWindow;
}) {
  const maxValue = Math.max(
    1,
    ...props.buckets.map((bucket) => Math.max(bucket.in ?? 0, bucket.out ?? 0)),
  );

  if (props.buckets.length === 0) {
    return <p className="deckgo-note">No throughput buckets loaded for {props.window}.</p>;
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
              {formatBucketTime(bucket.time, props.window)}
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
              in {messagesIn} / out {messagesOut}
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

function channelProbeLabel(result: DeckGoChannelTestResponse) {
  if (result.ok === true) {
    return "probe success";
  }
  if (/timeout|deadline/i.test(result.error ?? "")) {
    return "probe timeout";
  }
  return "probe failure";
}

function ChannelProbeResultBadge(props: { result: DeckGoChannelTestResponse }) {
  return (
    <div className="deckgo-pill-row deck-ui-channels-status-row">
      <span className={`deckgo-pill ${channelProbeTone(props.result)}`}>
        {channelProbeLabel(props.result)}
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
      setError(loadError instanceof Error ? loadError.message : "failed to load channels");
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
        setError(
          loadError instanceof Error ? loadError.message : "channel throughput fetch failed",
        );
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
  const selectedAccounts = normalizeChannelAccounts(rawChannelAccounts[selectedChannelId]);
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
    return sum + normalizeChannelAccounts(value).length;
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
    if (!window.confirm(`Logout channel ${selectedChannelId}?`)) {
      return;
    }
    setActionState("logging-out");
    try {
      const result = await logoutChannel(selectedChannelId);
      setActionResult(result);
      setError("");
      await refresh(selectedChannelId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "channel logout failed");
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
      setError(result.ok === false ? result.error || "channel test failed" : "");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "channel test failed");
    } finally {
      setActionState("idle");
    }
  };

  const toggleSelectedChannel = async () => {
    if (!selectedChannelId) {
      return;
    }
    const nextEnabled = !selectedChannelEnabled;
    if (!window.confirm(`Set channel ${selectedChannelId} enabled=${String(nextEnabled)}?`)) {
      return;
    }
    setActionState("toggling");
    try {
      const result = await patchChannelConfig(selectedChannelId, { enabled: nextEnabled });
      setConfigPatchResult(result);
      setError("");
      await refresh(selectedChannelId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "channel config patch failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-channels">
      <div className="deckgo-column deck-ui-channels-column">
        <article className="deckgo-card is-float deck-ui-channels-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Channel inventory</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Read and update channel runtime state through `channels.status`, logout, probe,
            throughput, and config routes.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-channels-body">
            <div className="deckgo-pill-row deck-ui-channels-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Inventory {loadState}
              </span>
              <span className="deckgo-pill">ts: {payload?.ts ?? "n/a"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-channels-stats">
              <ShellStat label="channels" value={channelOrder.length} />
              <ShellStat label="accounts" value={totalAccounts} />
              <ShellStat
                label="defaults"
                value={Object.keys(payload?.channelDefaultAccountId ?? {}).length}
              />
            </div>
            <div className="deckgo-actions deck-ui-channels-actions">
              <button
                className="deckgo-button deck-ui-channels-button"
                type="button"
                onClick={() => void refresh(selectedChannelId)}
              >
                Refresh channels
              </button>
              <button
                className="deckgo-button deck-ui-channels-button"
                type="button"
                onClick={() => void runLogout()}
                disabled={!selectedChannelId || actionState !== "idle"}
              >
                {actionState === "logging-out" ? "Logging out" : "Logout channel"}
              </button>
              <button
                className="deckgo-button deck-ui-channels-button"
                type="button"
                onClick={() => void runChannelTest()}
                disabled={!selectedChannelId || actionState !== "idle"}
              >
                {actionState === "testing" ? "Testing channel" : "Test channel"}
              </button>
              <button
                className="deckgo-button deck-ui-channels-button"
                type="button"
                onClick={() => void toggleSelectedChannel()}
                disabled={!selectedChannelId || actionState !== "idle"}
              >
                {actionState === "toggling"
                  ? "Saving config"
                  : selectedChannelEnabled
                    ? "Disable channel"
                    : "Enable channel"}
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-channels-error">{error}</p> : null}
            {channelOrder.length === 0 ? (
              <p className="deckgo-note deck-ui-channels-empty">No channels loaded.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-channels-list">
                {channelOrder.map((channelId) => {
                  const channelAccounts = normalizeChannelAccounts(rawChannelAccounts[channelId]);
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
                          id: {channelId} | detail:{" "}
                          {channelMeta?.detailLabel || detailLabels[channelId] || "n/a"} | default
                          account: {payload?.channelDefaultAccountId?.[channelId] || "n/a"}
                        </div>
                        <div className="deckgo-meta">
                          accounts: {channelAccounts.length} | alerts: {alertCount}
                          {channelMeta?.pluginId ? ` | plugin: ${channelMeta.pluginId}` : ""}
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
            <h2 className="deckgo-card-title">Selected channel</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This keeps the first channel slice narrow: inventory truth, account wiring, and logout.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-channels-body">
            {selectedChannelId ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-channels-hero">
                  <div>
                    <p className="deckgo-kicker">Channel</p>
                    <strong>{labels[selectedChannelId] || selectedChannelId}</strong>
                    <p className="deckgo-note">
                      detail:{" "}
                      {selectedChannelMeta?.detailLabel || detailLabels[selectedChannelId] || "n/a"}{" "}
                      | default account: {selectedDefaultAccountId || "n/a"}
                    </p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-channels-status-row">
                    <span className="deckgo-pill">{selectedAccounts.length} accounts</span>
                    <span
                      className={`deckgo-pill ${selectedChannelEnabled ? "is-positive" : "is-muted"}`}
                    >
                      {selectedChannelEnabled ? "enabled" : "disabled"}
                    </span>
                    <span
                      className={`deckgo-pill ${
                        countAlertingAccounts(selectedAccounts) > 0 ? "is-warning" : "is-positive"
                      }`}
                    >
                      {countAlertingAccounts(selectedAccounts)} alerts
                    </span>
                    <span className="deckgo-pill">channel id {selectedChannelId}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-channels-detail-stats">
                  <ShellStat label="label" value={labels[selectedChannelId] || selectedChannelId} />
                  <ShellStat
                    label="detail label"
                    value={
                      selectedChannelMeta?.detailLabel || detailLabels[selectedChannelId] || "n/a"
                    }
                  />
                  <ShellStat
                    label="system image"
                    value={
                      selectedChannelMeta?.systemImage || systemImages[selectedChannelId] || "n/a"
                    }
                  />
                  <ShellStat label="plugin" value={selectedChannelMeta?.pluginId || "n/a"} />
                  <ShellStat
                    label="plugin origin"
                    value={selectedChannelMeta?.pluginOrigin || "n/a"}
                  />
                  <ShellStat
                    label="plugin config"
                    value={selectedChannelMeta?.pluginConfigPath || "n/a"}
                  />
                  <ShellStat label="default account" value={selectedDefaultAccountId || "n/a"} />
                  <ShellStat label="messages in" value={throughputMessagesIn} />
                  <ShellStat label="messages out" value={throughputMessagesOut} />
                  <ShellStat label="throughput buckets" value={throughputBuckets.length} />
                  <ShellStat
                    label="probe latency"
                    value={selectedChannelLatency != null ? `${selectedChannelLatency}ms` : "n/a"}
                  />
                </div>
                {selectedChannelMeta?.pluginId ? (
                  <div className="deckgo-actions deck-ui-channels-actions deck-ui-channels-actions-offset">
                    <button
                      className="deckgo-button deck-ui-channels-button"
                      type="button"
                      onClick={() => navigateToPlugin(ui, selectedChannelMeta.pluginId)}
                    >
                      Open channel plugin
                    </button>
                  </div>
                ) : null}
                <div className="deckgo-surface-tile deck-ui-channels-surface">
                  <div className="deckgo-card-header deck-ui-channels-surface-head">
                    <div>
                      <p className="deckgo-surface-label">Throughput</p>
                      <p className="deckgo-note">
                        Throughput {throughputState} from channel runtime.
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
                  <ChannelThroughputChart buckets={throughputBuckets} window={throughputWindow} />
                </div>
                {selectedProbeResult ? (
                  <div className="deckgo-surface-tile deck-ui-channels-surface">
                    <p className="deckgo-surface-label">Probe result</p>
                    <ChannelProbeResultBadge result={selectedProbeResult} />
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
                          <p className="deckgo-note">Next: {account.diagnostic.nextStep}</p>
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
                  <p className="deckgo-note">No channel accounts reported.</p>
                )}
                <JsonDetails title="Channel metadata" payload={selectedChannelMeta ?? null} />
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
                <JsonDetails title="Channel payload" payload={selectedChannel} />
                <JsonDetails title="Channel test result" payload={selectedProbeResult} />
                <JsonDetails title="Channel config patch result" payload={configPatchResult} />
                <JsonDetails title="Logout result" payload={actionResult} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-channels-empty">
                Choose a channel to inspect its payload.
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
