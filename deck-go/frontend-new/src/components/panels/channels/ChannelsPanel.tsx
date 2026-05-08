import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DeckGoChannelsStatusResponse,
  DeckGoChannelTestResponse,
  DeckGoChannelThroughputBucket,
  DeckGoChannelThroughputResponse,
  DeckGoRoutingBinding,
  DeckGoRoutingListResponse,
} from "../../../api";
import { useDataFabricTransports } from "../../../data/client/scoped-query-provider";
import {
  channelThroughputQueryOptions,
  channelsListQueryOptions,
  useLogoutChannelMutation,
  usePatchChannelConfigMutation,
  useTestChannelMutation,
} from "../../../data/modules/channels";
import { routingBindingsQueryOptions } from "../../../data/modules/routing";
import { navigateToPlugin, navigateToRouting } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import {
  IconAlert,
  IconArrowL,
  IconArrowR,
  IconCheck,
  IconInfo,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconX,
} from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import { AccountDmPolicyEditor } from "./AccountDmPolicyEditor";
import { ChannelSettingsEditor } from "./ChannelSettingsEditor";
import { WecomAccessControls, type WecomAccessAccount } from "./WecomAccessControls";
import "./channels-panel.css";

type PanelState = "idle" | "loading" | "ready";
type ChannelDiagnosticTone = "success" | "warning" | "error" | "neutral" | "info";
type ThroughputWindow = "1h" | "6h" | "24h";
type ChannelsView = "list" | "detail";
type ChannelFilter = "all" | "enabled" | "alerts" | "wecom";
type ChannelTabId = "overview" | "throughput" | "probe" | "settings" | "routing" | "wecom";
type ChannelUiMeta = NonNullable<DeckGoChannelsStatusResponse["channelMeta"]>[number];
type ChannelTranslator = ReturnType<typeof useTranslations>;

const THROUGHPUT_WINDOWS: ThroughputWindow[] = ["1h", "6h", "24h"];
const FILTERS: ChannelFilter[] = ["all", "enabled", "alerts", "wecom"];
const CHANNEL_TABS: Array<{ id: ChannelTabId; wecomOnly?: boolean }> = [
  { id: "overview" },
  { id: "throughput" },
  { id: "probe" },
  { id: "settings" },
  { id: "routing" },
  { id: "wecom", wecomOnly: true },
];

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

type ChannelInventoryItem = {
  accounts: NormalizedChannelAccount[];
  alertCount: number;
  channel: Record<string, unknown>;
  defaultAccountId: string;
  detailLabel: string;
  enabled: boolean;
  id: string;
  label: string;
  meta?: ChannelUiMeta;
  throughputSummary: {
    messagesIn: number;
    messagesOut: number;
  };
};

function readChannelNavigationTarget() {
  if (typeof window === "undefined") {
    return { accountId: "", channelId: "", section: "" };
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
  if (enabled === undefined && configured === undefined && linked === undefined) {
    return {
      tone: "info",
      title: t("diagUnknownTitle"),
      description: t("diagUnknownDescription"),
      nextStep: t("diagUnknownNextStep"),
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
  if (tone === "info") {
    return "is-info";
  }
  return "is-muted";
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

function readThroughputSummary(channel: Record<string, unknown>) {
  const throughput = asRecord(channel.throughput);
  const messagesIn =
    numberValue(channel, "messagesIn") ??
    numberValue(channel, "throughputIn") ??
    numberValue(throughput, "messagesIn") ??
    numberValue(throughput, "in") ??
    0;
  const messagesOut =
    numberValue(channel, "messagesOut") ??
    numberValue(channel, "throughputOut") ??
    numberValue(throughput, "messagesOut") ??
    numberValue(throughput, "out") ??
    0;
  return { messagesIn, messagesOut };
}

function formatThroughputSummary(
  summary: ChannelInventoryItem["throughputSummary"],
  t: ChannelTranslator,
) {
  if (summary.messagesIn === 0 && summary.messagesOut === 0) {
    return t("throughputUnavailable");
  }
  return t("throughputInOut", { in: summary.messagesIn, out: summary.messagesOut });
}

function throughputSparkClass(
  summary: ChannelInventoryItem["throughputSummary"],
  totalMessagesIn: number,
) {
  if (summary.messagesIn <= 0) {
    return "is-zero";
  }
  const ratio = summary.messagesIn / Math.max(1, totalMessagesIn);
  if (ratio >= 0.66) {
    return "is-high";
  }
  if (ratio >= 0.33) {
    return "is-mid";
  }
  return "is-low";
}

function displayAccountName(account: NormalizedChannelAccount) {
  return (
    stringValue(account.payload, "displayName") ||
    stringValue(account.payload, "name") ||
    account.accountId
  );
}

function channelMatchesFilter(item: ChannelInventoryItem, filter: ChannelFilter) {
  if (filter === "enabled") {
    return item.enabled;
  }
  if (filter === "alerts") {
    return item.alertCount > 0;
  }
  if (filter === "wecom") {
    return item.id === "wecom" || item.meta?.pluginId === "wecom";
  }
  return true;
}

function hasWecomChannel(items: ChannelInventoryItem[]) {
  return items.some((item) => item.id === "wecom" || item.meta?.pluginId === "wecom");
}

function ChannelGlyph(props: { id: string; label: string }) {
  const letters = props.label.slice(0, 2).toUpperCase();
  return (
    <span className="channels-glyph" data-channel={props.id} aria-hidden="true">
      {letters}
    </span>
  );
}

function MetricTile(props: { hint?: string; label: string; value: string | number }) {
  return (
    <article className="kpi">
      <span className="kpi__label">{props.label}</span>
      <span className="kpi__value">{props.value}</span>
      {props.hint ? <span className="kpi__hint">{props.hint}</span> : null}
    </article>
  );
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

function ChannelThroughputChart(props: {
  buckets: DeckGoChannelThroughputBucket[];
  messagesIn: number;
  messagesOut: number;
  window: ThroughputWindow;
  t: ChannelTranslator;
}) {
  const maxValue = Math.max(
    1,
    ...props.buckets.map((bucket) => Math.max(bucket.in ?? 0, bucket.out ?? 0)),
  );

  if (props.buckets.length === 0) {
    return (
      <div className="empty empty--compact">
        <strong>{props.t("noThroughputBucketsTitle")}</strong>
        <span>{props.t("noThroughputBuckets", { window: props.window })}</span>
      </div>
    );
  }

  return (
    <>
      <div
        className="chart deck-ui-channels-chart"
        role="img"
        aria-label={props.t("throughputChartLabel", {
          in: props.messagesIn,
          out: props.messagesOut,
        })}
        data-testid="channel-throughput-chart"
      >
        {props.buckets.map((bucket, index) => {
          const inbound = bucket.in ?? 0;
          const outbound = bucket.out ?? 0;
          return (
            <div className="chart__bar" key={`${bucket.time ?? index}:${index}`}>
              <progress className="chart__seg chart__seg--in" max={maxValue} value={inbound} />
              <progress className="chart__seg chart__seg--out" max={maxValue} value={outbound} />
            </div>
          );
        })}
      </div>
      <div className="chart__legend">
        <span>
          <span className="chart__swatch is-in" />
          {props.t("messagesInStat")} {props.messagesIn}
        </span>
        <span>
          <span className="chart__swatch is-out" />
          {props.t("messagesOutStat")} {props.messagesOut}
        </span>
      </div>
    </>
  );
}

function ChannelRoutingPanel(props: { accountId: string; channelId: string }) {
  const t = useTranslations("channels");
  const ui = useDeckUI();
  const queryClient = useQueryClient();
  const { bff } = useDataFabricTransports();
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [routing, setRouting] = useState<DeckGoRoutingListResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoadState("loading");
    void queryClient
      .fetchQuery(
        routingBindingsQueryOptions(bff, { channel: props.channelId, accountId: props.accountId }),
      )
      .then((next) => {
        if (!mounted) {
          return;
        }
        setRouting(next);
        setError("");
        setLoadState("ready");
      })
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setRouting(null);
        setError(loadError instanceof Error ? loadError.message : t("routingBindingsFetchFailed"));
        setLoadState("idle");
      });
    return () => {
      mounted = false;
    };
  }, [bff, props.accountId, props.channelId, queryClient, t]);

  const bindings = routing?.bindings ?? [];

  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h2 className="section__title">{t("routingBindings")}</h2>
          <p className="section__hint">
            {loadState === "loading"
              ? t("routingBindingsLoading")
              : t("routingBindingsCount", { count: bindings.length })}
          </p>
        </div>
        <button
          className="btn"
          type="button"
          onClick={() =>
            navigateToRouting(ui, {
              channelId: props.channelId,
              accountId: props.accountId,
            })
          }
        >
          {t("openRouting")}
          <IconArrowR />
        </button>
      </header>
      {error ? <p className="deckgo-note deck-ui-channels-error">{error}</p> : null}
      {bindings.length === 0 ? (
        <div className="empty empty--compact">
          <strong>{t("noRoutingBindings")}</strong>
          <span>{t("noRoutingBindingsDescription")}</span>
        </div>
      ) : (
        <div className="routing-list">
          {bindings.map((binding: DeckGoRoutingBinding) => (
            <article className="routing-row" key={binding.id}>
              <div>
                <strong>{binding.agentId}</strong>
                <p>
                  {binding.tier} / {binding.match.channel}
                  {binding.match.accountId ? ` / ${binding.match.accountId}` : ""}
                </p>
              </div>
              <span className="deckgo-pill">{binding.match.peer?.kind ?? t("notAvailable")}</span>
            </article>
          ))}
        </div>
      )}
      <JsonDetails title={t("routingPayload")} payload={routing} />
    </section>
  );
}

export function ChannelsPanel() {
  const t = useTranslations("channels");
  const ui = useDeckUI();
  const queryClient = useQueryClient();
  const { bff } = useDataFabricTransports();
  const testChannelMutation = useTestChannelMutation();
  const logoutChannelMutation = useLogoutChannelMutation();
  const patchChannelConfigMutation = usePatchChannelConfigMutation();
  const searchRef = useRef<HTMLInputElement>(null);
  const [navigationTarget] = useState(readChannelNavigationTarget);
  const [payload, setPayload] = useState<DeckGoChannelsStatusResponse | null>(null);
  const [throughput, setThroughput] = useState<DeckGoChannelThroughputResponse | null>(null);
  const [throughputWindow, setThroughputWindow] = useState<ThroughputWindow>("1h");
  const [channelTestResult, setChannelTestResult] = useState<DeckGoChannelTestResponse | null>(
    null,
  );
  const [configPatchResult, setConfigPatchResult] = useState<unknown>(null);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [view, setView] = useState<ChannelsView>("list");
  const [activeTab, setActiveTab] = useState<ChannelTabId>(
    navigationTarget.section === "access" ? "wecom" : "overview",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ChannelFilter>("all");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [_throughputState, setThroughputState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "logging-out" | "testing" | "toggling">(
    "idle",
  );
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [testResultDialogOpen, setTestResultDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const labels = payload?.channelLabels ?? {};
  const detailLabels = payload?.channelDetailLabels ?? {};
  const channelMetaById = useMemo(() => {
    const entries = Array.isArray(payload?.channelMeta) ? payload.channelMeta : [];
    return new Map(entries.map((entry: ChannelUiMeta) => [entry.id, entry]));
  }, [payload?.channelMeta]);

  const refresh = async (preferredChannelId?: string) => {
    setLoadState("loading");
    try {
      const next = await queryClient.fetchQuery({
        ...channelsListQueryOptions(bff),
        staleTime: 0,
      });
      setPayload(next);
      setLoadState("ready");
      setError("");
      const rawChannels = asRecord(next.channels);
      const order = next.channelOrder?.length ? next.channelOrder : Object.keys(rawChannels);
      const preferred =
        preferredChannelId?.trim() || navigationTarget.channelId || selectedChannelId || "";
      const nextSelected =
        preferred && order.includes(preferred)
          ? preferred
          : order.includes(selectedChannelId)
            ? selectedChannelId
            : order[0] || "";
      setSelectedChannelId(nextSelected);
      if (nextSelected && (navigationTarget.channelId || preferredChannelId)) {
        setView("detail");
      }
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : t("loadChannelsFailed"));
    }
  };

  useEffect(() => {
    void refresh(navigationTarget.channelId);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setView("list");
        window.requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === "Escape" && view === "detail") {
        event.preventDefault();
        setView("list");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [view]);

  useEffect(() => {
    if (!selectedChannelId) {
      setThroughput(null);
      setThroughputState("idle");
      return undefined;
    }
    let mounted = true;
    setThroughputState("loading");
    void queryClient
      .fetchQuery(channelThroughputQueryOptions(bff, selectedChannelId, throughputWindow))
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
  }, [bff, queryClient, selectedChannelId, throughputWindow, t]);

  const channelItems = useMemo<ChannelInventoryItem[]>(() => {
    const rawChannels = asRecord(payload?.channels);
    const rawChannelAccounts = asRecord(payload?.channelAccounts);
    const order = payload?.channelOrder?.length ? payload.channelOrder : Object.keys(rawChannels);
    return order.map((channelId) => {
      const channel = asRecord(rawChannels[channelId]);
      const accounts = normalizeChannelAccounts(rawChannelAccounts[channelId], t);
      const meta = channelMetaById.get(channelId);
      const enabled =
        booleanValue(channel, "enabled") ??
        accounts.some((account) => booleanValue(account.payload, "enabled") === true);
      return {
        accounts,
        alertCount: countAlertingAccounts(accounts),
        channel,
        defaultAccountId: payload?.channelDefaultAccountId?.[channelId] || "",
        detailLabel: meta?.detailLabel || detailLabels[channelId] || "",
        enabled,
        id: channelId,
        label: labels[channelId] || meta?.label || channelId,
        meta,
        throughputSummary: readThroughputSummary(channel),
      };
    });
  }, [
    channelMetaById,
    detailLabels,
    labels,
    payload?.channelAccounts,
    payload?.channelDefaultAccountId,
    payload?.channelOrder,
    payload?.channels,
    t,
  ]);

  const selectedItem =
    channelItems.find((item) => item.id === selectedChannelId) ?? channelItems[0] ?? null;
  const selectedIsWecomAccessChannel =
    selectedItem?.id === "wecom" || selectedItem?.meta?.pluginId === "wecom";
  const availableTabs = CHANNEL_TABS.filter(
    (tab) => !tab.wecomOnly || selectedIsWecomAccessChannel,
  );
  const selectedTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : "overview";
  const selectedProbeResult =
    channelTestResult?.channelId === selectedItem?.id ? channelTestResult : null;
  const selectedChannelLatency = selectedItem
    ? (numberValue(selectedItem.channel, "latencyMs") ?? selectedProbeResult?.latencyMs)
    : undefined;
  const selectedAccessAccounts: WecomAccessAccount[] =
    selectedItem?.accounts.map((account) => ({
      accountId: account.accountId,
      label: displayAccountName(account),
    })) ?? [];
  const throughputBuckets = Array.isArray(throughput?.buckets) ? throughput.buckets : [];
  const throughputMessagesIn = throughput?.messagesIn ?? 0;
  const throughputMessagesOut = throughput?.messagesOut ?? 0;

  const totals = useMemo(() => {
    const totalAccounts = channelItems.reduce((sum, item) => sum + item.accounts.length, 0);
    const enabled = channelItems.filter((item) => item.enabled).length;
    const alerts = channelItems.reduce((sum, item) => sum + item.alertCount, 0);
    const degraded = channelItems.filter((item) => item.enabled && item.alertCount > 0).length;
    const messagesIn = channelItems.reduce(
      (sum, item) => sum + item.throughputSummary.messagesIn,
      0,
    );
    const messagesOut = channelItems.reduce(
      (sum, item) => sum + item.throughputSummary.messagesOut,
      0,
    );
    return { alerts, degraded, enabled, messagesIn, messagesOut, totalAccounts };
  }, [channelItems]);
  const filterCounts = useMemo<Record<ChannelFilter, number>>(
    () => ({
      alerts: channelItems.filter((item) => channelMatchesFilter(item, "alerts")).length,
      all: channelItems.length,
      enabled: channelItems.filter((item) => channelMatchesFilter(item, "enabled")).length,
      wecom: channelItems.filter((item) => channelMatchesFilter(item, "wecom")).length,
    }),
    [channelItems],
  );
  const availableFilters = useMemo(
    () => FILTERS.filter((entry) => entry !== "wecom" || hasWecomChannel(channelItems)),
    [channelItems],
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return channelItems.filter((item) => {
      if (!channelMatchesFilter(item, filter)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [item.id, item.label, item.detailLabel, item.meta?.pluginId ?? ""].some((candidate) =>
        candidate.toLowerCase().includes(query),
      );
    });
  }, [channelItems, filter, searchQuery]);

  useEffect(() => {
    if (!availableFilters.includes(filter)) {
      setFilter("all");
    }
  }, [availableFilters, filter]);

  const openDetail = (channelId: string, tab: ChannelTabId = "overview") => {
    setSelectedChannelId(channelId);
    setActiveTab(tab);
    setError("");
    setView("detail");
  };

  const runLogout = async () => {
    if (!selectedItem) {
      return;
    }
    setLogoutDialogOpen(false);
    setActionState("logging-out");
    try {
      const result = await logoutChannelMutation.mutateAsync(selectedItem.id);
      setActionResult(result);
      setError("");
      await refresh(selectedItem.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("logoutFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const runChannelTest = async () => {
    if (!selectedItem) {
      return;
    }
    setActionState("testing");
    try {
      const result = await testChannelMutation.mutateAsync(selectedItem.id);
      setChannelTestResult({ ...result, channelId: result.channelId || selectedItem.id });
      setTestResultDialogOpen(true);
      setActiveTab("probe");
      setError(result.ok === false ? result.error || t("testFailed") : "");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("testFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const toggleSelectedChannel = async () => {
    if (!selectedItem) {
      return;
    }
    const nextEnabled = !selectedItem.enabled;
    if (
      !window.confirm(
        t("confirmSetChannelEnabled", {
          channelId: selectedItem.id,
          value: String(nextEnabled),
        }),
      )
    ) {
      return;
    }
    setActionState("toggling");
    try {
      const result = await patchChannelConfigMutation.mutateAsync({
        channelId: selectedItem.id,
        patch: { enabled: nextEnabled },
      });
      setConfigPatchResult(result);
      setError("");
      await refresh(selectedItem.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("configPatchFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const renderList = () => (
    <main className="view list-view">
      <header className="list-view__head">
        <div>
          <p className="channels-panel__eyebrow">{t("operationsTrail")}</p>
          <h1 className="list-view__title">{t("title")}</h1>
          <p className="list-view__subtitle">{t("inventoryDescription")}</p>
        </div>
        <div className="list-view__actions">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => void refresh(selectedItem?.id)}
          >
            <IconRefresh />
            {t("refreshChannels")}
          </button>
          <button
            className="btn btn--primary"
            type="button"
            disabled
            title={t("createChannelUnavailable")}
          >
            <IconPlus />
            {t("newChannel")}
          </button>
        </div>
      </header>

      <div className="kpi-strip" role="group" aria-label={t("inventoryKpis")}>
        <MetricTile
          label={t("channelsStat")}
          value={channelItems.length}
          hint={t("enabledCount", { count: totals.enabled })}
        />
        <MetricTile
          label={t("accountsStat")}
          value={totals.totalAccounts}
          hint={t("acrossProviders")}
        />
        <MetricTile
          label={t("alertsBadge", { count: totals.alerts })}
          value={totals.alerts}
          hint={t("accountsNeedingAttention")}
        />
        <MetricTile
          label={t("unhealthyStat")}
          value={totals.degraded}
          hint={t("enabledProbeFailed")}
        />
        <MetricTile
          label={t("throughput")}
          value={totals.messagesIn}
          hint={t("messagesOutSummary", { count: totals.messagesOut })}
        />
      </div>

      <div className="toolbar">
        <label className="toolbar__search">
          <IconSearch />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("searchChannelsPlaceholder")}
          />
          <span className="kbd">cmd+k</span>
        </label>
        <div className="toolbar__filter" role="group" aria-label={t("filter")}>
          {availableFilters.map((entry) => (
            <button
              key={entry}
              type="button"
              className={filter === entry ? "is-active" : ""}
              onClick={() => setFilter(entry)}
            >
              {t(`filter_${entry}`)} {filterCounts[entry]}
            </button>
          ))}
        </div>
      </div>

      <div className="row__head" role="row">
        <div />
        <div>{t("channelColumn")}</div>
        <div>{t("throughput")}</div>
        <div>{t("probeColumn")}</div>
        <div>{t("accountsStat")}</div>
        <div>{t("statusColumn")}</div>
      </div>

      {loadState === "loading" && (
        <div className="empty">
          <span className="spinner" />
          {t("loadingChannels")}
        </div>
      )}
      {error && loadState !== "loading" ? (
        <div className="empty">
          <strong>{t("loadChannelsFailed")}</strong>
          <span>{error}</span>
          <button
            className="btn btn--sm"
            type="button"
            onClick={() => void refresh(selectedItem?.id)}
          >
            {t("refreshChannels")}
          </button>
        </div>
      ) : null}
      {loadState !== "loading" && channelItems.length === 0 ? (
        <div className="empty">
          <IconInfo />
          <strong>{t("noChannelsLoaded")}</strong>
          <span>{t("noChannelsLoadedDescription")}</span>
        </div>
      ) : null}
      {loadState !== "loading" && channelItems.length > 0 && filteredItems.length === 0 ? (
        <div className="empty">
          <strong>{t("noFilteredChannels")}</strong>
          <span>{t("noFilteredChannelsDescription")}</span>
          <span>
            {[
              searchQuery.trim() ? t("criteriaSearch", { value: searchQuery.trim() }) : "",
              filter !== "all" ? t("criteriaFilter", { value: t(`filter_${filter}`) }) : "",
            ]
              .filter(Boolean)
              .join(" | ")}
          </span>
          <button
            className="btn btn--sm"
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilter("all");
            }}
          >
            {t("clearFilters")}
          </button>
        </div>
      ) : null}

      {filteredItems.length > 0 ? (
        <div className="channels-list" role="list">
          {filteredItems.map((item) => (
            <button
              className={`row deck-ui-channels-row ${selectedItem?.id === item.id ? "is-selected" : ""}`}
              key={item.id}
              type="button"
              onClick={() => openDetail(item.id)}
            >
              <ChannelGlyph id={item.id} label={item.label} />
              <span className="row__id">
                <strong>{item.label}</strong>
                <small>{item.detailLabel || item.meta?.pluginId || item.id}</small>
              </span>
              <span className="row__throughput">
                <span
                  className={`row__spark ${throughputSparkClass(
                    item.throughputSummary,
                    totals.messagesIn,
                  )}`}
                  aria-hidden="true"
                >
                  <span />
                </span>
                <small>{formatThroughputSummary(item.throughputSummary, t)}</small>
              </span>
              <span className="row__probe">
                {!item.enabled ? (
                  <span className="deckgo-pill is-muted">{t("disabled")}</span>
                ) : item.alertCount > 0 ? (
                  <span className="deckgo-pill is-warning">
                    <IconAlert />
                    {t("alertsBadge", { count: item.alertCount })}
                  </span>
                ) : (
                  <span className="deckgo-pill is-positive">
                    <IconCheck />
                    {t("diagHealthyTitle")}
                  </span>
                )}
              </span>
              <span className="row__num">{item.accounts.length}</span>
              <span>
                <span className={`deckgo-pill ${item.enabled ? "is-positive" : "is-muted"}`}>
                  {item.enabled ? t("enabled") : t("disabled")}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <footer className="view__footer">
        <span>
          {t("filteredCount", { shown: filteredItems.length, total: channelItems.length })}
        </span>
        <span>{t("timestampValue", { value: payload?.ts ?? t("notAvailable") })}</span>
      </footer>
    </main>
  );

  const renderOverview = () => {
    if (!selectedItem) {
      return null;
    }
    const alerts = selectedItem.accounts.filter(
      (account) => account.diagnostic.tone === "warning" || account.diagnostic.tone === "error",
    );
    return (
      <>
        <section className="section">
          <header className="section__head">
            <div>
              <h2 className="section__title">{t("inventorySnapshot")}</h2>
              <p className="section__hint">{t("inventorySnapshotHint")}</p>
            </div>
          </header>
          <div className="tile-row">
            <MetricTile
              label={t("messagesInStat")}
              value={throughputMessagesIn}
              hint={throughputWindow}
            />
            <MetricTile
              label={t("messagesOutStat")}
              value={throughputMessagesOut}
              hint={throughputWindow}
            />
            <MetricTile
              label={t("probeLatencyStat")}
              value={
                selectedChannelLatency != null ? `${selectedChannelLatency}ms` : t("notAvailable")
              }
              hint={
                selectedProbeResult ? channelProbeLabel(selectedProbeResult, t) : t("probeResult")
              }
            />
            <MetricTile
              label={t("accountsStat")}
              value={selectedItem.accounts.length}
              hint={t("alertsBadge", { count: alerts.length })}
            />
          </div>
        </section>

        {alerts.length > 0 ? (
          <section className="section">
            <header className="section__head">
              <div>
                <h2 className="section__title">{t("accountAlerts")}</h2>
                <p className="section__hint">{t("accountAlertsHint")}</p>
              </div>
            </header>
            <div className="acct-list">
              {alerts.map((account) => (
                <article
                  className="acct-row"
                  data-health={account.diagnostic.tone}
                  key={account.accountId}
                >
                  <span className="acct-row__indicator" />
                  <div>
                    <strong>
                      {displayAccountName(account)} <small>{account.accountId}</small>
                    </strong>
                    <p>{account.diagnostic.description}</p>
                    <p>{t("nextStep", { step: account.diagnostic.nextStep })}</p>
                  </div>
                  <span className={`deckgo-pill ${diagnosticClassName(account.diagnostic.tone)}`}>
                    {account.diagnostic.title}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="section">
          <header className="section__head">
            <h2 className="section__title">{t("quickLinks")}</h2>
          </header>
          <div className="hero__actions">
            {selectedItem.meta?.pluginId ? (
              <button
                className="btn"
                type="button"
                onClick={() => navigateToPlugin(ui, selectedItem.meta?.pluginId ?? "")}
              >
                {t("openChannelPlugin")}
                <IconArrowR />
              </button>
            ) : null}
            <button className="btn" type="button" onClick={() => setActiveTab("routing")}>
              {t("routingBindings")}
            </button>
            <button className="btn" type="button" onClick={() => setActiveTab("settings")}>
              {t("channelSettings")}
            </button>
          </div>
        </section>
      </>
    );
  };

  const renderProbe = () =>
    selectedItem ? (
      <section className="section">
        <header className="section__head">
          <div>
            <h2 className="section__title">{t("probeResult")}</h2>
            <p className="section__hint">{t("probeDescription")}</p>
          </div>
          <button
            className="btn btn--primary"
            type="button"
            disabled={actionState !== "idle"}
            onClick={() => void runChannelTest()}
          >
            {actionState === "testing" ? t("testingChannel") : t("testChannel")}
          </button>
        </header>
        {selectedProbeResult ? (
          <ChannelProbeResultBadge result={selectedProbeResult} t={t} />
        ) : (
          <div className="empty empty--compact">
            <strong>{t("noProbeResultTitle")}</strong>
            <span>{t("noProbeResultDescription")}</span>
          </div>
        )}
        <div className="acct-list">
          {selectedItem.accounts.map((account) => (
            <article
              className="acct-row"
              data-health={account.diagnostic.tone}
              key={account.accountId}
            >
              <span className="acct-row__indicator" />
              <div>
                <strong>
                  {displayAccountName(account)} <small>{account.accountId}</small>
                </strong>
                <p>{account.diagnostic.description}</p>
                <p>{t("nextStep", { step: account.diagnostic.nextStep })}</p>
              </div>
              <span className={`deckgo-pill ${diagnosticClassName(account.diagnostic.tone)}`}>
                {account.diagnostic.title}
              </span>
            </article>
          ))}
        </div>
      </section>
    ) : null;

  const renderSettings = () =>
    selectedItem ? (
      <section className="section">
        <header className="section__head">
          <div>
            <h2 className="section__title">{t("channelSettings")}</h2>
            <p className="section__hint">{t("settingsContractHint")}</p>
          </div>
          <button
            className="btn"
            type="button"
            disabled={actionState !== "idle"}
            onClick={() => void toggleSelectedChannel()}
          >
            {actionState === "toggling"
              ? t("savingConfig")
              : selectedItem.enabled
                ? t("disableChannel")
                : t("enableChannel")}
          </button>
        </header>
        {!selectedIsWecomAccessChannel ? (
          <ChannelSettingsEditor
            channelId={selectedItem.id}
            channel={selectedItem.channel}
            onSaved={async (result) => {
              setConfigPatchResult(result);
              await refresh(selectedItem.id);
            }}
          />
        ) : (
          <div className="empty empty--compact">
            <strong>{t("wecomSettingsDelegated")}</strong>
            <span>{t("wecomSettingsDelegatedDescription")}</span>
          </div>
        )}
        {!selectedIsWecomAccessChannel && selectedItem.accounts.length > 0 ? (
          <div className="acct-list">
            {selectedItem.accounts.map((account) => (
              <article className="acct-row acct-row--stack" key={account.accountId}>
                <div>
                  <strong>
                    {displayAccountName(account)} <small>{account.accountId}</small>
                  </strong>
                  <p>{account.diagnostic.description}</p>
                </div>
                <AccountDmPolicyEditor
                  channelId={selectedItem.id}
                  accountId={account.accountId}
                  accountPayload={account.payload}
                  onSaved={async (result) => {
                    setConfigPatchResult(result);
                    await refresh(selectedItem.id);
                  }}
                />
              </article>
            ))}
          </div>
        ) : null}
        <JsonDetails title={t("channelConfigPatchResult")} payload={configPatchResult} />
      </section>
    ) : null;

  const renderTab = () => {
    if (!selectedItem) {
      return null;
    }
    if (selectedTab === "throughput") {
      return (
        <section className="section">
          <header className="section__head">
            <div>
              <h2 className="section__title">
                {t("throughput")} / {throughputWindow}
              </h2>
              <p className="section__hint">{t("throughputContractHint")}</p>
            </div>
            <div className="toolbar__filter">
              {THROUGHPUT_WINDOWS.map((window) => (
                <button
                  className={throughputWindow === window ? "is-active" : ""}
                  key={window}
                  type="button"
                  onClick={() => setThroughputWindow(window)}
                >
                  {window}
                </button>
              ))}
            </div>
          </header>
          <ChannelThroughputChart
            buckets={throughputBuckets}
            messagesIn={throughputMessagesIn}
            messagesOut={throughputMessagesOut}
            window={throughputWindow}
            t={t}
          />
        </section>
      );
    }
    if (selectedTab === "probe") {
      return renderProbe();
    }
    if (selectedTab === "settings") {
      return renderSettings();
    }
    if (selectedTab === "routing") {
      return (
        <ChannelRoutingPanel
          accountId={selectedItem.defaultAccountId}
          channelId={selectedItem.id}
        />
      );
    }
    if (selectedTab === "wecom" && selectedIsWecomAccessChannel) {
      return (
        <section className="section">
          <WecomAccessControls
            channelId={selectedItem.id}
            accounts={selectedAccessAccounts}
            defaultAccountId={selectedItem.defaultAccountId}
            initialAccountId={navigationTarget.accountId}
            initialFocus={navigationTarget.section === "access" ? "access" : undefined}
            onSaved={() => refresh(selectedItem.id)}
          />
        </section>
      );
    }
    return renderOverview();
  };

  const renderDetail = () =>
    selectedItem ? (
      <main className="view detail-view">
        <div className="detail__head">
          <button
            className="btn btn--ghost detail__back"
            type="button"
            onClick={() => setView("list")}
          >
            <IconArrowL />
            {t("backToChannels")}
          </button>
          <span className="detail__back-trail">/ {selectedItem.label}</span>
        </div>

        <header className="hero">
          <ChannelGlyph id={selectedItem.id} label={selectedItem.label} />
          <div>
            <h1 className="hero__title">
              {selectedItem.label}
              <small>{selectedItem.id}</small>
            </h1>
            <p className="hero__sub">
              {selectedItem.detailLabel || t("notAvailable")}
              {selectedItem.meta?.pluginId ? ` / ${selectedItem.meta.pluginId}` : ""}
              {selectedItem.defaultAccountId ? ` / ${selectedItem.defaultAccountId}` : ""}
            </p>
            <div className="hero__meta">
              <span className={`deckgo-pill ${selectedItem.enabled ? "is-positive" : "is-muted"}`}>
                {selectedItem.enabled ? t("enabled") : t("disabled")}
              </span>
              <span className="deckgo-pill">
                {t("accountsBadge", { count: selectedItem.accounts.length })}
              </span>
              <span
                className={`deckgo-pill ${selectedItem.alertCount > 0 ? "is-warning" : "is-positive"}`}
              >
                {t("alertsBadge", { count: selectedItem.alertCount })}
              </span>
              {selectedProbeResult ? (
                <span className={`deckgo-pill ${channelProbeTone(selectedProbeResult)}`}>
                  {channelProbeLabel(selectedProbeResult, t)}
                </span>
              ) : null}
              {selectedItem.meta?.pluginOrigin ? (
                <span className="deckgo-pill">{selectedItem.meta.pluginOrigin}</span>
              ) : null}
            </div>
          </div>
          <div className="hero__actions">
            <button
              className="btn"
              type="button"
              disabled={actionState !== "idle"}
              onClick={() => void runChannelTest()}
            >
              {actionState === "testing" ? t("testingChannel") : t("testChannel")}
            </button>
            <button
              className="btn btn--danger"
              type="button"
              disabled={!selectedItem.enabled || actionState !== "idle"}
              onClick={() => setLogoutDialogOpen(true)}
            >
              {actionState === "logging-out" ? t("loggingOut") : t("logoutChannel")}
            </button>
          </div>
        </header>

        {error ? <p className="deckgo-note deck-ui-channels-error">{error}</p> : null}

        <nav className="tabs" role="tablist" aria-label={t("channelTabs")}>
          {availableTabs.map((tab) => (
            <button
              aria-selected={selectedTab === tab.id}
              className={`tab ${selectedTab === tab.id ? "is-active" : ""}`}
              key={tab.id}
              role="tab"
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {t(`tab_${tab.id}`)}
              {tab.id === "routing" ? (
                <span className="tab__count">{selectedItem.defaultAccountId ? 1 : 0}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <section className="detail__body">{renderTab()}</section>

        <footer className="view__footer">
          <span>{t("timestampValue", { value: payload?.ts ?? t("notAvailable") })}</span>
          <span>{t("describeDriftNote")}</span>
        </footer>
        <JsonDetails title={t("channelMetadata")} payload={selectedItem.meta ?? null} />
        <JsonDetails title={t("channelPayload")} payload={selectedItem.channel} />
        <JsonDetails title={t("channelTestResult")} payload={selectedProbeResult} />
        <JsonDetails title={t("logoutResult")} payload={actionResult} />
      </main>
    ) : (
      renderList()
    );

  return (
    <section className="channels-panel" data-testid="channels-panel">
      {view === "detail" && selectedItem ? renderDetail() : renderList()}
      {testResultDialogOpen && selectedProbeResult ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setTestResultDialogOpen(false);
            }
          }}
        >
          <article
            aria-label={t("testResultDialogTitle")}
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <header className="modal__head">
              <div>
                <h2>{t("testResultDialogTitle")}</h2>
                <p>{selectedItem?.label ?? selectedProbeResult.channelId}</p>
              </div>
              <button
                aria-label={t("closeDialog")}
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => setTestResultDialogOpen(false)}
              >
                <IconX />
              </button>
            </header>
            <div className="modal__body">
              <ChannelProbeResultBadge result={selectedProbeResult} t={t} />
              <JsonDetails title={t("channelTestResult")} payload={selectedProbeResult} />
            </div>
            <footer className="modal__foot">
              <button
                className="btn btn--primary"
                type="button"
                onClick={() => setTestResultDialogOpen(false)}
              >
                {t("closeDialog")}
              </button>
            </footer>
          </article>
        </div>
      ) : null}
      {logoutDialogOpen && selectedItem ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setLogoutDialogOpen(false);
            }
          }}
        >
          <article
            aria-label={t("logoutConfirmTitle")}
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <header className="modal__head">
              <div>
                <h2>{t("logoutConfirmTitle")}</h2>
                <p>{t("logoutConfirmDescription", { channelId: selectedItem.id })}</p>
              </div>
              <button
                aria-label={t("closeDialog")}
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => setLogoutDialogOpen(false)}
              >
                <IconX />
              </button>
            </header>
            <footer className="modal__foot">
              <button className="btn" type="button" onClick={() => setLogoutDialogOpen(false)}>
                {t("cancel")}
              </button>
              <button
                className="btn btn--danger"
                type="button"
                disabled={actionState !== "idle"}
                onClick={() => void runLogout()}
              >
                {actionState === "logging-out" ? t("loggingOut") : t("confirmLogoutAction")}
              </button>
            </footer>
          </article>
        </div>
      ) : null}
    </section>
  );
}
