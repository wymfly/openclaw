import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  fetchActivityEvents,
  fetchGatewayDescribe,
  fetchGatewayHealth,
  fetchGatewayStatus,
  fetchMonitorRuns,
  fetchMonitorStats,
  isBundledRuntimeStatus,
  isRemoteRuntimeStatus,
  submitGatewayBatch,
  type DeckGoActivityEvent,
  type DeckGoBundledRuntimeGatewayStatus,
  type DeckGoGatewayBatchCall,
  type DeckGoGatewayBatchOptions,
  type DeckGoGatewayBatchResponse,
  type DeckGoGatewayBatchResultEntry,
  type DeckGoGatewayDescribeEvent,
  type DeckGoGatewayDescribeMethod,
  type DeckGoGatewayDescribeResponse,
  type DeckGoGatewayHealthResponse,
  type DeckGoGatewayStatusResponse,
  type DeckGoMonitorRun,
  type DeckGoMonitorStatsResponse,
  type DeckGoRemoteRuntimeGatewayStatus,
} from "../../../api";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useCapabilities } from "../../../hooks/useCapabilities";
import { useTranslations } from "../../../i18n/provider";
import {
  GatewayNotConfiguredEmptyState,
  gatewayNotConfiguredValue,
  isGatewayNotConfiguredValue,
} from "../../runtime/GatewayNotConfiguredEmptyState";
import "./gateway-panel.css";

type GatewayTab = "describe" | "batch" | "activity";
type DescribeMode = "methods" | "events";
type ScopeFilter = "all" | "operator.read" | "operator.write" | "system";
type MetricTone = "good" | "warn" | "bad" | "neutral" | "info";

type DescribeMethodEntry = DeckGoGatewayDescribeMethod & {
  kind: "method";
  name: string;
};

type DescribeEventEntry = DeckGoGatewayDescribeEvent & {
  kind: "event";
  name: string;
};

type BatchDraftCall = {
  id: string;
  method: string;
  paramsText: string;
};

type RecentBatch = DeckGoGatewayBatchResponse & {
  calls: DeckGoGatewayBatchCall[];
  durationMs: number;
  options?: DeckGoGatewayBatchOptions;
  requestedAt: number;
};

type ChannelEntry = {
  connected: boolean;
  id: string;
  label: string;
  lastSeen?: number;
};

type HeartbeatAgent = {
  agentId: string;
  enabled: boolean;
  every: string;
  sessions: number;
};

type RelativeTimeLabels = {
  daysAgo: string;
  hoursAgo: string;
  justNow: string;
  minutesAgo: string;
  notAvailable: string;
};

const GATEWAY_TABS: Array<{ key: GatewayTab; labelKey: string }> = [
  { key: "describe", labelKey: "tabs.describe" },
  { key: "batch", labelKey: "tabs.batch" },
  { key: "activity", labelKey: "tabs.activity" },
];

const SCOPE_FILTERS: ScopeFilter[] = ["all", "operator.read", "operator.write", "system"];
const DEFAULT_RUNTIME_ID = "rt_local";

function sessionCountFromStatus(value: DeckGoGatewayStatusResponse["sessions"]) {
  if (typeof value === "number") {
    return value;
  }
  return typeof value?.count === "number" ? value.count : 0;
}

function sessionCountFromHealth(health: DeckGoGatewayHealthResponse | null) {
  if (typeof health?.sessions?.count === "number") {
    return health.sessions.count;
  }
  return (health?.agents ?? []).reduce((sum, agent) => {
    const sessions =
      typeof agent === "object" && agent != null
        ? (agent as { sessions?: { count?: number } }).sessions
        : undefined;
    return sum + (sessions?.count ?? 0);
  }, 0);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function channelState(value: unknown) {
  if (typeof value === "boolean") {
    return { connected: value };
  }
  if (typeof value === "string") {
    return {
      connected: ["connected", "ready", "ok", "online", "active"].includes(value.toLowerCase()),
    };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const connected =
      record.connected === true ||
      record.linked === true ||
      readString(record.status).toLowerCase() === "connected" ||
      readString(record.status).toLowerCase() === "ready";
    return {
      connected,
      lastSeen: readNumber(record.lastSeen) ?? readNumber(record.lastSeenMs),
    };
  }
  return { connected: false };
}

function normalizeChannels(
  health: DeckGoGatewayHealthResponse | null,
  status: DeckGoGatewayStatusResponse | null,
) {
  const source =
    health?.channels && Object.keys(health.channels).length > 0
      ? health.channels
      : status?.channels;
  const order = health?.channelOrder?.length ? health.channelOrder : Object.keys(source ?? {});
  return order.map((id) => {
    const state = channelState(source?.[id]);
    return {
      connected: state.connected,
      id,
      label: health?.channelLabels?.[id] ?? id,
      lastSeen: state.lastSeen,
    } satisfies ChannelEntry;
  });
}

function agentIdFromHealth(agent: unknown) {
  if (!agent || typeof agent !== "object") {
    return "";
  }
  const record = agent as Record<string, unknown>;
  return readString(record.agentId) || readString(record.id) || readString(record.name);
}

function normalizeHeartbeatAgents(
  health: DeckGoGatewayHealthResponse | null,
  status: DeckGoGatewayStatusResponse | null,
) {
  const healthSessions = new Map<string, number>();
  for (const agent of health?.agents ?? []) {
    const id = agentIdFromHealth(agent);
    if (!id || typeof agent !== "object" || agent == null) {
      continue;
    }
    const sessions = (agent as { sessions?: { count?: number } }).sessions?.count ?? 0;
    healthSessions.set(id, sessions);
  }
  const heartbeat = status?.heartbeat;
  if (typeof heartbeat === "string") {
    return heartbeat.trim()
      ? [{ agentId: heartbeat.trim(), enabled: true, every: "", sessions: 0 }]
      : [];
  }
  return (heartbeat?.agents ?? []).map((agent, index) => {
    const record =
      typeof agent === "object" && agent != null ? (agent as Record<string, unknown>) : {};
    const agentId = readString(record.agentId) || readString(record.id) || `agent-${index + 1}`;
    return {
      agentId,
      enabled: record.enabled !== false,
      every: readString(record.every) || "n/a",
      sessions: healthSessions.get(agentId) ?? 0,
    } satisfies HeartbeatAgent;
  });
}

function runtimeTone(value: string | undefined | null): MetricTone {
  if (value === "running" || value === "healthy" || value === "active" || value === "ok") {
    return "good";
  }
  if (value === "starting" || value === "stopping" || value === "degraded" || value === "warning") {
    return "warn";
  }
  if (value === "failed" || value === "unhealthy" || value === "error" || value === "down") {
    return "bad";
  }
  return "neutral";
}

function boolTone(value: boolean | undefined): MetricTone {
  if (value === true) {
    return "good";
  }
  if (value === false) {
    return "warn";
  }
  return "neutral";
}

function formatBool(
  value: boolean | undefined,
  labels: { no: string; unknown: string; yes: string },
) {
  if (value === true) {
    return labels.yes;
  }
  if (value === false) {
    return labels.no;
  }
  return labels.unknown;
}

function formatMs(value: number | undefined | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }
  return `${(value / 1000).toFixed(2)}s`;
}

function formatSeconds(value: number | undefined | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${value}s`;
}

function formatTimestamp(value: number | string | undefined | null) {
  if (!value) {
    return "n/a";
  }
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

function relativeTimeLabels(t: ReturnType<typeof useTranslations>): RelativeTimeLabels {
  return {
    daysAgo: t("relative.daysAgo"),
    hoursAgo: t("relative.hoursAgo"),
    justNow: t("relative.justNow"),
    minutesAgo: t("relative.minutesAgo"),
    notAvailable: t("relative.notAvailable"),
  };
}

function formatCountTemplate(template: string, count: number, fallback: string) {
  return template.includes("{count}") ? template.replace("{count}", String(count)) : fallback;
}

function formatRelative(value: number | string | undefined | null, labels?: RelativeTimeLabels) {
  if (!value) {
    return labels?.notAvailable ?? "n/a";
  }
  const ts = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(ts)) {
    return labels?.notAvailable ?? "n/a";
  }
  const diff = Date.now() - ts;
  if (diff < 60_000) {
    return labels?.justNow ?? "just now";
  }
  if (diff < 3_600_000) {
    const count = Math.round(diff / 60_000);
    return formatCountTemplate(labels?.minutesAgo ?? "", count, `${count}m ago`);
  }
  if (diff < 86_400_000) {
    const count = Math.round(diff / 3_600_000);
    return formatCountTemplate(labels?.hoursAgo ?? "", count, `${count}h ago`);
  }
  const count = Math.round(diff / 86_400_000);
  return formatCountTemplate(labels?.daysAgo ?? "", count, `${count}d ago`);
}

function jsonBlock(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function methodEntries(describe: DeckGoGatewayDescribeResponse | null) {
  return Object.entries(describe?.methods ?? {})
    .map(([name, meta]) => ({ ...meta, kind: "method" as const, name }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

function eventEntries(describe: DeckGoGatewayDescribeResponse | null) {
  return Object.entries(describe?.events ?? {})
    .map(([name, meta]) => ({ ...meta, kind: "event" as const, name }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

function isSafeBatchMethod(method: string, meta?: DeckGoGatewayDescribeMethod) {
  const trimmed = method.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== "gateway.batch" &&
    !trimmed.endsWith(".subscribe") &&
    !trimmed.endsWith(".unsubscribe") &&
    meta?.scope !== "operator.write"
  );
}

function defaultParamsForMethod(method: string) {
  if (method === "gateway.describe") {
    return JSON.stringify({ includeSchemas: false }, null, 2);
  }
  return "{}";
}

function makeDraftCall(index: number, method: string): BatchDraftCall {
  return {
    id: `c${index + 1}`,
    method,
    paramsText: defaultParamsForMethod(method),
  };
}

function parseParams(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }
  return JSON.parse(trimmed) as unknown;
}

function bucketIndexFromTimestamp(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(11, Math.floor((value % 720_000) / 60_000)));
}

function metricToneClass(tone: MetricTone) {
  return `gateway-metric is-${tone}`;
}

function pillToneClass(tone: MetricTone = "neutral") {
  return `gateway-pill is-${tone}`;
}

function MetricTile({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: MetricTone;
  value: string | number;
}) {
  return (
    <div className={metricToneClass(tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: MetricTone }) {
  return <span className={pillToneClass(tone)}>{children}</span>;
}

function ScopePill({ scope }: { scope?: string }) {
  const tone: MetricTone =
    scope === "operator.read"
      ? "good"
      : scope === "operator.write"
        ? "warn"
        : scope === "system"
          ? "info"
          : "neutral";
  return <span className={`gateway-scope gateway-scope--${tone}`}>{scope || "n/a"}</span>;
}

function SinceTag({ since }: { since?: number }) {
  if (since == null) {
    return null;
  }
  return <span className="gateway-since">v{since}</span>;
}

function ConnDot({ connected }: { connected: boolean }) {
  return (
    <span className={`gateway-conn-dot ${connected ? "is-on" : "is-off"}`} aria-hidden="true" />
  );
}

function FieldRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="gateway-field-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function GatewayPanel() {
  const t = useTranslations("monitor");
  const [activeTab, setActiveTab] = useState<GatewayTab>("describe");
  const { bootstrap, runtime, refreshingSummary, refreshRuntimeSummary } = useDeckUI();
  const { capabilities } = useCapabilities();
  const [describeResponse, setDescribeResponse] = useState<DeckGoGatewayDescribeResponse | null>(
    null,
  );
  const [healthResponse, setHealthResponse] = useState<DeckGoGatewayHealthResponse | null>(null);
  const [statusResponse, setStatusResponse] = useState<DeckGoGatewayStatusResponse | null>(null);
  const [activityEvents, setActivityEvents] = useState<DeckGoActivityEvent[]>([]);
  const [monitorRuns, setMonitorRuns] = useState<DeckGoMonitorRun[]>([]);
  const [monitorStats, setMonitorStats] = useState<DeckGoMonitorStatsResponse | null>(null);
  const [recentBatches, setRecentBatches] = useState<RecentBatch[]>([]);
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const [describeError, setDescribeError] = useState("");
  const [projectionError, setProjectionError] = useState("");

  const refreshDiagnostics = useCallback(async () => {
    const [healthResult, statusResult, describeResult] = await Promise.allSettled([
      fetchGatewayHealth(),
      fetchGatewayStatus(),
      fetchGatewayDescribe(),
    ]);

    if (healthResult.status === "fulfilled") {
      setHealthResponse(healthResult.value);
    }
    if (statusResult.status === "fulfilled") {
      setStatusResponse(statusResult.value);
    }
    if (describeResult.status === "fulfilled") {
      setDescribeResponse(describeResult.value);
      setDescribeError("");
    } else {
      setDescribeError(gatewayNotConfiguredValue(describeResult.reason, t("errors.loadDescribe")));
    }

    const diagnosticsFailure =
      healthResult.status === "rejected"
        ? healthResult.reason
        : statusResult.status === "rejected"
          ? statusResult.reason
          : null;
    setDiagnosticsError(
      diagnosticsFailure
        ? gatewayNotConfiguredValue(diagnosticsFailure, t("errors.loadDiagnostics"))
        : "",
    );
  }, [t]);

  const refreshProjections = useCallback(async () => {
    try {
      const [activity, runs, stats] = await Promise.all([
        fetchActivityEvents(20),
        fetchMonitorRuns({ limit: 20 }),
        fetchMonitorStats(),
      ]);
      setActivityEvents(activity.events ?? []);
      setMonitorRuns(runs.runs ?? []);
      setMonitorStats(stats);
      setProjectionError("");
    } catch (loadError) {
      setProjectionError(gatewayNotConfiguredValue(loadError, t("errors.loadMonitorProjections")));
    }
  }, [t]);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  useEffect(() => {
    void refreshProjections();
  }, [refreshProjections]);

  const refreshWorkbench = () => {
    void refreshRuntimeSummary();
    void refreshDiagnostics();
    void refreshProjections();
  };

  const runtimePayload = runtime?.runtime;
  const bootstrapRuntime = bootstrap?.runtime;
  const bundledRuntime = isBundledRuntimeStatus(runtimePayload)
    ? runtimePayload
    : isBundledRuntimeStatus(bootstrapRuntime)
      ? bootstrapRuntime
      : null;
  const remoteRuntime = isRemoteRuntimeStatus(runtimePayload)
    ? runtimePayload
    : isRemoteRuntimeStatus(bootstrapRuntime)
      ? bootstrapRuntime
      : null;
  const runtimeMode =
    capabilities?.mode ?? runtimePayload?.mode ?? bootstrapRuntime?.mode ?? "unknown";
  const runtimeConfigured =
    capabilities?.configured ?? runtimePayload?.configured ?? bootstrapRuntime?.configured;
  const supervisorState = capabilities?.supervisorState ?? runtimeMode === "bundled";
  const runtimeStatus = runtimePayload?.status || bootstrapRuntime?.status || "unknown";
  const runtimeHealth = runtimePayload?.health || bootstrapRuntime?.health || "unknown";
  const gatewayUrl =
    runtimePayload?.gatewayUrl || bootstrapRuntime?.gatewayUrl || t("runtime.notResolved");
  const gatewayConnected =
    bootstrap?.gateway.connected ||
    (remoteRuntime?.lastConnectedAt != null && !remoteRuntime.lastError) ||
    healthResponse?.ok === true;
  const gatewayHealthTone: MetricTone =
    healthResponse?.ok === false ? "bad" : gatewayConnected ? "good" : "neutral";
  const gatewayHealthLabel =
    healthResponse?.ok === false
      ? t("workbench.gatewayDown")
      : gatewayConnected
        ? t("workbench.gatewayOk")
        : t("workbench.gatewayPending");
  const gatewayNotConfigured =
    isGatewayNotConfiguredValue(diagnosticsError) ||
    isGatewayNotConfiguredValue(describeError) ||
    isGatewayNotConfiguredValue(projectionError);
  const boolLabels = {
    no: t("runtime.no"),
    unknown: t("runtime.unknown"),
    yes: t("runtime.yes"),
  };

  const channels = useMemo(
    () => normalizeChannels(healthResponse, statusResponse),
    [healthResponse, statusResponse],
  );
  const heartbeatAgents = useMemo(
    () => normalizeHeartbeatAgents(healthResponse, statusResponse),
    [healthResponse, statusResponse],
  );
  const methods = useMemo(() => methodEntries(describeResponse), [describeResponse]);
  const events = useMemo(() => eventEntries(describeResponse), [describeResponse]);
  const methodMap = useMemo(
    () => new Map(methods.map((method) => [method.name, method])),
    [methods],
  );
  const safeMethods = useMemo(
    () => methods.filter((method) => isSafeBatchMethod(method.name, method)),
    [methods],
  );

  const sessionCount =
    sessionCountFromHealth(healthResponse) || sessionCountFromStatus(statusResponse?.sessions);
  const connectedChannels = channels.filter((channel) => channel.connected).length;
  const enabledAgents = heartbeatAgents.filter((agent) => agent.enabled).length;
  const healthLatency = formatMs(healthResponse?.durationMs);
  const runtimeVersion = statusResponse?.runtimeVersion || t("runtime.unknown");
  const defaultModel =
    typeof statusResponse?.sessions === "object"
      ? statusResponse.sessions.defaults?.model || t("runtime.unknown")
      : t("runtime.unknown");
  const bootstrapOk = bootstrap?.ok !== false;
  const canSubmitBatch =
    runtimeMode === "bundled" && runtimeConfigured !== false && safeMethods.length > 0;

  return (
    <section className="gateway-panel gateway-app" data-testid="gateway-panel">
      <header className="gateway-app__topbar">
        <div className="gateway-app__brand">
          <p className="gateway-eyebrow">{t("workbench.eyebrow")}</p>
          <h2>{t("workbench.title")}</h2>
          <p className="gateway-note">
            <code>{runtimeVersion}</code> · {t("workbench.heartbeatSeconds")}{" "}
            <code>{formatSeconds(healthResponse?.heartbeatSeconds)}</code> ·{" "}
            {t("workbench.lastProbe")} <code>{formatTimestamp(healthResponse?.ts)}</code>
          </p>
        </div>
        <div className="gateway-header-actions">
          <StatusPill tone={gatewayHealthTone}>{gatewayHealthLabel}</StatusPill>
          <StatusPill tone={runtimeTone(statusResponse?.state || runtimeStatus)}>
            {t("overview.state")} {statusResponse?.state || runtimeStatus}
          </StatusPill>
          <StatusPill tone={bootstrapOk ? "good" : "bad"}>
            {bootstrapOk ? t("workbench.bootstrapOk") : t("workbench.bootstrapPending")}
          </StatusPill>
          <button
            className="gateway-button"
            disabled={refreshingSummary}
            type="button"
            onClick={refreshWorkbench}
          >
            {t("runtime.refresh")}
          </button>
        </div>
      </header>

      <section className="gateway-app__hero">
        <div className="gateway-metrics" aria-label={t("workbench.metrics")}>
          <MetricTile
            detail={`${t("workbench.defaultModel")} ${defaultModel}`}
            label={t("sessions")}
            tone={sessionCount > 0 ? "good" : "neutral"}
            value={sessionCount}
          />
          <MetricTile
            detail={t("workbench.connectedFraction")}
            label={t("channels")}
            tone={connectedChannels > 0 ? "good" : "warn"}
            value={`${connectedChannels}/${channels.length}`}
          />
          <MetricTile
            detail={t("workbench.enabledFraction")}
            label={t("workbench.agentsHeartbeating")}
            tone={enabledAgents > 0 ? "good" : "neutral"}
            value={`${enabledAgents}/${heartbeatAgents.length}`}
          />
          <MetricTile
            detail={`${t("runtime.mode")} ${runtimeMode}`}
            label={t("runtime.health")}
            tone={runtimeTone(runtimeHealth)}
            value={runtimeHealth}
          />
          <MetricTile
            detail={gatewayUrl}
            label={t("workbench.healthProbe")}
            tone={healthResponse?.ok === false ? "bad" : "info"}
            value={healthLatency}
          />
        </div>

        <div className="gateway-app__hero-rails">
          <ChannelRail channels={channels} linkChannel={statusResponse?.linkChannel} t={t} />
          <HeartbeatRail
            agents={heartbeatAgents}
            defaultAgentId={
              typeof statusResponse?.heartbeat === "object"
                ? statusResponse.heartbeat.defaultAgentId
                : healthResponse?.defaultAgentId
            }
            t={t}
          />
        </div>
      </section>

      {gatewayNotConfigured ? <GatewayNotConfiguredEmptyState className="gateway-empty" /> : null}

      <ThroughputCard
        activityEvents={activityEvents}
        monitorRuns={monitorRuns}
        monitorStats={monitorStats}
        recentBatches={recentBatches}
        status={statusResponse}
        t={t}
      />

      <section className="gateway-app__tabs-section">
        <div className="gateway-tabs" role="tablist" aria-label={t("tabs.sections")}>
          {GATEWAY_TABS.map((tab) => (
            <button
              aria-controls={`deck-ui-gateway-${tab.key}`}
              aria-selected={activeTab === tab.key}
              className={activeTab === tab.key ? "is-active" : ""}
              key={tab.key}
              role="tab"
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.labelKey)}
              {tab.key === "batch" ? <span>{recentBatches.length}</span> : null}
              {tab.key === "activity" ? <span>{activityEvents.length}</span> : null}
            </button>
          ))}
        </div>

        <div hidden={activeTab !== "describe"} id="deck-ui-gateway-describe" role="tabpanel">
          <DescribeExplorer
            describe={describeResponse}
            describeError={describeError}
            events={events}
            methods={methods}
            t={t}
          />
        </div>

        <div hidden={activeTab !== "batch"} id="deck-ui-gateway-batch" role="tabpanel">
          <BatchConsole
            canSubmit={canSubmitBatch}
            methodMap={methodMap}
            recentBatches={recentBatches}
            runtimeMode={runtimeMode}
            safeMethods={safeMethods}
            setRecentBatches={setRecentBatches}
            t={t}
          />
        </div>

        <div hidden={activeTab !== "activity"} id="deck-ui-gateway-activity" role="tabpanel">
          <ActivityList
            events={activityEvents}
            monitorRuns={monitorRuns}
            monitorStats={monitorStats}
            projectionError={projectionError}
            t={t}
          />
        </div>
      </section>

      <RuntimeFacts
        boolLabels={boolLabels}
        bundledRuntime={bundledRuntime}
        gatewayConnected={gatewayConnected}
        gatewayUrl={gatewayUrl}
        remoteRuntime={remoteRuntime}
        runtimeConfigured={runtimeConfigured}
        runtimeHealth={runtimeHealth}
        runtimeMode={runtimeMode}
        runtimeStatus={runtimeStatus}
        supervisorState={supervisorState}
        t={t}
      />

      {diagnosticsError && !isGatewayNotConfiguredValue(diagnosticsError) ? (
        <p className="gateway-error" role="alert">
          {diagnosticsError}
        </p>
      ) : null}
    </section>
  );
}

function ChannelRail({
  channels,
  linkChannel,
  t,
}: {
  channels: ChannelEntry[];
  linkChannel?: DeckGoGatewayStatusResponse["linkChannel"];
  t: ReturnType<typeof useTranslations>;
}) {
  const relativeLabels = relativeTimeLabels(t);
  return (
    <article className="gateway-rail">
      <header>
        <h3>{t("workbench.channelSummary")}</h3>
        <p>
          {linkChannel?.label || t("runtime.unknown")} · {t("workbench.authAge")}{" "}
          {formatMs(linkChannel?.authAgeMs)}
        </p>
      </header>
      {channels.length === 0 ? (
        <p className="gateway-empty-text">{t("workbench.noChannels")}</p>
      ) : (
        <ul className="gateway-chip-list">
          {channels.map((channel) => (
            <li
              className={`gateway-channel-chip ${channel.connected ? "is-on" : "is-off"}`}
              key={channel.id}
            >
              <ConnDot connected={channel.connected} />
              <strong>{channel.label}</strong>
              <span>{formatRelative(channel.lastSeen, relativeLabels)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function HeartbeatRail({
  agents,
  defaultAgentId,
  t,
}: {
  agents: HeartbeatAgent[];
  defaultAgentId?: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <article className="gateway-rail">
      <header>
        <h3>{t("workbench.heartbeatAgents")}</h3>
        <p>
          {agents.length} {t("overview.agents")} · {t("overview.defaultAgent")}{" "}
          <code>{defaultAgentId || "n/a"}</code>
        </p>
      </header>
      {agents.length === 0 ? (
        <p className="gateway-empty-text">{t("workbench.noHeartbeatAgents")}</p>
      ) : (
        <ul className="gateway-chip-list">
          {agents.map((agent) => (
            <li
              className={`gateway-agent-chip ${agent.enabled ? "is-on" : "is-off"}`}
              key={agent.agentId}
            >
              <strong>{agent.agentId}</strong>
              <span>{agent.every}</span>
              <span>
                {agent.sessions} {t("sessions")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ThroughputCard({
  activityEvents,
  monitorRuns,
  monitorStats,
  recentBatches,
  status,
  t,
}: {
  activityEvents: DeckGoActivityEvent[];
  monitorRuns: DeckGoMonitorRun[];
  monitorStats: DeckGoMonitorStatsResponse | null;
  recentBatches: RecentBatch[];
  status: DeckGoGatewayStatusResponse | null;
  t: ReturnType<typeof useTranslations>;
}) {
  const buckets = useMemo(() => {
    const base = Array.from({ length: 12 }, (_, index) => ({
      errors: 0,
      latency: 0,
      requests: 0,
      ts: Date.now() - (11 - index) * 60_000,
    }));
    for (const event of activityEvents) {
      const index = bucketIndexFromTimestamp(event.timestamp ?? Date.now());
      base[index].requests += 1;
    }
    for (const run of monitorRuns) {
      const index = bucketIndexFromTimestamp(new Date(run.lastEventAt ?? "").getTime());
      base[index].requests += Math.max(1, run.eventCount ?? 0);
      base[index].latency += run.eventCount ?? 0;
    }
    for (const batch of recentBatches) {
      const index = bucketIndexFromTimestamp(batch.requestedAt);
      base[index].requests += batch.results.length;
      base[index].errors += batch.results.filter((result) => !result.ok).length;
      base[index].latency += batch.durationMs;
    }
    return base;
  }, [activityEvents, monitorRuns, recentBatches]);
  const requests = buckets.reduce((sum, bucket) => sum + bucket.requests, 0);
  const errors = buckets.reduce((sum, bucket) => sum + bucket.errors, 0);
  const latency = buckets.reduce((sum, bucket) => sum + bucket.latency, 0);
  const errorRate = requests > 0 ? (errors / requests) * 100 : 0;
  const avgLatency = Math.round(
    latency / Math.max(1, buckets.filter((bucket) => bucket.latency > 0).length),
  );

  return (
    <article className="gateway-throughput">
      <header className="gateway-card__header">
        <div>
          <h3>{t("throughput.title")}</h3>
          <p>{t("throughput.hint")}</p>
        </div>
        <StatusPill>{t("throughput.projectionLabel")}</StatusPill>
      </header>
      <div className="gateway-throughput__grid">
        <SparkMetric
          label={t("throughput.requests")}
          tone="info"
          value={requests}
          values={buckets.map((b) => b.requests)}
        />
        <SparkMetric
          label={t("throughput.errorRate")}
          tone={errorRate > 1 ? "warn" : "good"}
          value={`${errorRate.toFixed(2)}%`}
          values={buckets.map((b) => b.errors)}
        />
        <SparkMetric
          label={t("throughput.latencyP95")}
          tone="info"
          value={`${avgLatency}ms`}
          values={buckets.map((b) => b.latency)}
        />
        <div className="gateway-throughput-card">
          <span>{t("throughput.queuedEvents")}</span>
          <strong>{status?.queuedSystemEvents?.length ?? 0}</strong>
          <ul>
            {(status?.queuedSystemEvents ?? []).slice(0, 4).map((event) => (
              <li key={event}>
                <code>{event}</code>
              </li>
            ))}
          </ul>
          {monitorStats ? (
            <small>
              {t("stats.totalRuns")}: {monitorStats.totalRuns}
            </small>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SparkMetric({
  label,
  tone,
  value,
  values,
}: {
  label: string;
  tone: MetricTone;
  value: string | number;
  values: number[];
}) {
  const max = Math.max(...values, 1);
  const width = 160;
  const height = 34;
  const gap = 2;
  const barWidth = Math.max(3, (width - gap * (values.length - 1)) / Math.max(1, values.length));
  return (
    <div className={`gateway-throughput-card is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <svg className="gateway-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {values.map((entry, index) => (
          <rect
            height={Math.max(2, (entry / max) * (height - 2))}
            key={`${label}-${index}`}
            rx="1.5"
            width={barWidth}
            x={index * (barWidth + gap)}
            y={height - Math.max(2, (entry / max) * (height - 2))}
          />
        ))}
      </svg>
    </div>
  );
}

function DescribeExplorer({
  describe,
  describeError,
  events,
  methods,
  t,
}: {
  describe: DeckGoGatewayDescribeResponse | null;
  describeError: string;
  events: DescribeEventEntry[];
  methods: DescribeMethodEntry[];
  t: ReturnType<typeof useTranslations>;
}) {
  const [mode, setMode] = useState<DescribeMode>("methods");
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [selectedKey, setSelectedKey] = useState("");
  const list = mode === "methods" ? methods : events;
  const filtered = list.filter((entry) => {
    if (entry.kind === "method" && scopeFilter !== "all" && entry.scope !== scopeFilter) {
      return false;
    }
    const q = query.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return `${entry.name} ${entry.kind === "method" ? (entry.scope ?? "") : "event"}`
      .toLowerCase()
      .includes(q);
  });
  const selected = filtered.find((entry) => entry.name === selectedKey) ?? filtered[0] ?? null;

  return (
    <article className="describe-explorer gateway-card">
      <header className="gateway-card__header">
        <div>
          <h3>{t("describe.title")}</h3>
          <p>
            gateway.describe · {methods.length} {t("overview.methods")} · {events.length}{" "}
            {t("overview.events")} · {describe?.untyped?.length ?? 0} {t("overview.untyped")}
          </p>
        </div>
        {describeError && !isGatewayNotConfiguredValue(describeError) ? (
          <StatusPill tone="warn">{t("overview.describeUnavailable")}</StatusPill>
        ) : null}
      </header>
      <div className="describe-explorer__controls">
        <div className="gateway-segments" role="tablist" aria-label={t("describe.mode")}>
          <button
            aria-selected={mode === "methods"}
            className={mode === "methods" ? "is-active" : ""}
            role="tab"
            type="button"
            onClick={() => {
              setMode("methods");
              setSelectedKey("");
            }}
          >
            {t("describe.methods")} <span>{methods.length}</span>
          </button>
          <button
            aria-selected={mode === "events"}
            className={mode === "events" ? "is-active" : ""}
            role="tab"
            type="button"
            onClick={() => {
              setMode("events");
              setSelectedKey("");
            }}
          >
            {t("describe.events")} <span>{events.length}</span>
          </button>
        </div>
        <label className="gateway-search">
          <span>{t("describe.search")}</span>
          <input
            aria-label={t("describe.search")}
            placeholder={
              mode === "methods" ? t("describe.searchMethods") : t("describe.searchEvents")
            }
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {mode === "methods" ? (
          <div className="gateway-segments" role="tablist" aria-label={t("describe.scope")}>
            {SCOPE_FILTERS.map((scope) => (
              <button
                aria-selected={scopeFilter === scope}
                className={scopeFilter === scope ? "is-active" : ""}
                key={scope}
                role="tab"
                type="button"
                onClick={() => setScopeFilter(scope)}
              >
                {t(`describe.scope_${scope.replace(".", "_")}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="describe-explorer__split">
        <div className="describe-explorer__list" role="region" aria-label={t("describe.entries")}>
          {filtered.length === 0 ? (
            <div className="gateway-empty-panel">
              <strong>{t("describe.noEntries")}</strong>
              <span>{t("describe.clearFilters")}</span>
            </div>
          ) : (
            <ul className="gateway-list" role="list">
              {filtered.map((entry) => (
                <li key={entry.name}>
                  <button
                    aria-pressed={selected?.name === entry.name}
                    className={`describe-row ${selected?.name === entry.name ? "is-selected" : ""}`}
                    type="button"
                    onClick={() => setSelectedKey(entry.name)}
                  >
                    <code>{entry.name}</code>
                    <span>
                      {entry.kind === "method" ? (
                        <ScopePill scope={entry.scope} />
                      ) : (
                        <span className="gateway-event-tag">event</span>
                      )}
                      <SinceTag since={entry.since} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="describe-explorer__detail" role="region" aria-label={t("describe.detail")}>
          {selected ? (
            <DescribeDetail entry={selected} mode={mode} t={t} />
          ) : (
            <p>{t("describe.pickEntry")}</p>
          )}
        </div>
      </div>
      {mode === "methods" && describe?.untyped?.length ? (
        <footer className="describe-explorer__untyped">
          <h3>{t("describe.untypedMethods")}</h3>
          <p>{t("describe.untypedHint")}</p>
          <ul>
            {describe.untyped.map((method) => (
              <li key={method}>
                <code>{method}</code>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}

function DescribeDetail({
  entry,
  mode,
  t,
}: {
  entry: DescribeEventEntry | DescribeMethodEntry;
  mode: DescribeMode;
  t: ReturnType<typeof useTranslations>;
}) {
  const params = entry.kind === "method" ? jsonBlock(entry.params) : "";
  const result = entry.kind === "method" ? jsonBlock(entry.result) : "";
  const payload = entry.kind === "event" ? jsonBlock(entry.payload) : "";
  return (
    <div className="describe-detail">
      <header>
        <code>{entry.name}</code>
        <span>
          {mode === "methods" && entry.kind === "method" ? (
            <ScopePill scope={entry.scope} />
          ) : (
            <span className="gateway-event-tag">event</span>
          )}
          <SinceTag since={entry.since} />
        </span>
      </header>
      {params ? <JsonSection title={t("describe.params")} value={params} /> : null}
      {result ? <JsonSection title={t("describe.result")} value={result} /> : null}
      {payload ? <JsonSection title={t("describe.payload")} value={payload} /> : null}
      {!params && !result && !payload ? (
        <p className="gateway-empty-text">{t("describe.noSchema")}</p>
      ) : null}
    </div>
  );
}

function JsonSection({ title, value }: { title: string; value: string }) {
  return (
    <section className="json-section">
      <h4>{title}</h4>
      <pre>{value}</pre>
    </section>
  );
}

function BatchConsole({
  canSubmit,
  methodMap,
  recentBatches,
  runtimeMode,
  safeMethods,
  setRecentBatches,
  t,
}: {
  canSubmit: boolean;
  methodMap: Map<string, DescribeMethodEntry>;
  recentBatches: RecentBatch[];
  runtimeMode: string;
  safeMethods: DescribeMethodEntry[];
  setRecentBatches: Dispatch<SetStateAction<RecentBatch[]>>;
  t: ReturnType<typeof useTranslations>;
}) {
  const defaultMethod =
    safeMethods.find((method) => method.name === "gateway.describe")?.name ??
    safeMethods[0]?.name ??
    "";
  const [draftCalls, setDraftCalls] = useState<BatchDraftCall[]>(() => [
    makeDraftCall(0, defaultMethod),
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [expandedBatch, setExpandedBatch] = useState("");

  useEffect(() => {
    setDraftCalls((current) => {
      if (current.length > 0 && current[0].method) {
        return current;
      }
      return [makeDraftCall(0, defaultMethod)];
    });
  }, [defaultMethod]);

  const updateCall = (index: number, patch: Partial<BatchDraftCall>) => {
    setDraftCalls((current) =>
      current.map((call, callIndex) => (callIndex === index ? { ...call, ...patch } : call)),
    );
  };
  const addCall = () =>
    setDraftCalls((current) => [...current, makeDraftCall(current.length, defaultMethod)]);
  const removeCall = (index: number) =>
    setDraftCalls((current) =>
      current.length > 1 ? current.filter((_, callIndex) => callIndex !== index) : current,
    );

  const submit = async () => {
    setSubmitError("");
    const calls: DeckGoGatewayBatchCall[] = [];
    for (const call of draftCalls) {
      const method = call.method.trim();
      const meta = methodMap.get(method);
      if (!method) {
        setSubmitError(t("batch.emptyMethod"));
        return;
      }
      if (!isSafeBatchMethod(method, meta)) {
        setSubmitError(t("batch.unsafeMethod", { method }));
        return;
      }
      try {
        calls.push({ id: call.id, method, params: parseParams(call.paramsText) });
      } catch {
        setSubmitError(t("batch.invalidJson", { id: call.id }));
        return;
      }
    }

    const startedAt = Date.now();
    setSubmitting(true);
    try {
      const result = await submitGatewayBatch(
        { calls, options: { failFast: false, timeoutMs: 5000 } },
        { runtimeId: DEFAULT_RUNTIME_ID },
      );
      const next = {
        ...result,
        calls,
        durationMs: Date.now() - startedAt,
        options: { failFast: false, timeoutMs: 5000 },
        requestedAt: startedAt,
      } satisfies RecentBatch;
      setRecentBatches((current) => [next, ...current].slice(0, 8));
      setExpandedBatch(result.requestId || next.requestId || "");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("batch.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const disabledReason =
    runtimeMode !== "bundled"
      ? t("batch.remoteLocked")
      : safeMethods.length === 0
        ? t("batch.noSafeMethods")
        : t("batch.configuredLocked");

  return (
    <article className="batch-console gateway-card">
      <header className="gateway-card__header">
        <div>
          <h3>{t("batch.title")}</h3>
          <p>{t("batch.hint")}</p>
        </div>
        <StatusPill tone={canSubmit ? "good" : "warn"}>
          {canSubmit ? t("batch.available") : t("batch.locked")}
        </StatusPill>
      </header>
      {!canSubmit ? <p className="gateway-warning">{disabledReason}</p> : null}
      <div className="batch-console__composer" aria-disabled={!canSubmit}>
        <div className="batch-console__table">
          <div className="batch-console__row is-head">
            <span>{t("batch.id")}</span>
            <span>{t("batch.method")}</span>
            <span>{t("batch.params")}</span>
            <span>{t("batch.actions")}</span>
          </div>
          {draftCalls.map((call, index) => (
            <div className="batch-console__row" key={call.id}>
              <code>{call.id}</code>
              <select
                aria-label={`${t("batch.method")} ${call.id}`}
                disabled={!canSubmit || submitting}
                value={call.method}
                onChange={(event) =>
                  updateCall(index, {
                    method: event.target.value,
                    paramsText: defaultParamsForMethod(event.target.value),
                  })
                }
              >
                {safeMethods.map((method) => (
                  <option key={method.name} value={method.name}>
                    {method.name}
                  </option>
                ))}
              </select>
              <textarea
                aria-label={`${t("batch.params")} ${call.id}`}
                disabled={!canSubmit || submitting}
                value={call.paramsText}
                onChange={(event) => updateCall(index, { paramsText: event.target.value })}
              />
              <button
                className="gateway-button"
                disabled={!canSubmit || submitting || draftCalls.length === 1}
                type="button"
                onClick={() => removeCall(index)}
              >
                {t("batch.removeCall")}
              </button>
            </div>
          ))}
        </div>
        <div className="batch-console__actions">
          <button
            className="gateway-button"
            disabled={!canSubmit || submitting}
            type="button"
            onClick={addCall}
          >
            {t("batch.addCall")}
          </button>
          <button
            className="gateway-button is-primary"
            disabled={!canSubmit || submitting}
            type="button"
            onClick={submit}
          >
            {submitting ? t("batch.submitting") : t("batch.submit")}
          </button>
        </div>
        {submitError ? (
          <p className="gateway-error" role="alert">
            {submitError}
          </p>
        ) : null}
      </div>

      <section className="batch-console__recent">
        <header>
          <h3>{t("batch.recent")}</h3>
          <p>
            {recentBatches.length} {t("batch.batches")}
          </p>
        </header>
        {recentBatches.length === 0 ? (
          <p className="gateway-empty-text">{t("batch.noRecent")}</p>
        ) : (
          <ul className="gateway-list">
            {recentBatches.map((batch) => (
              <li key={batch.requestId}>
                <BatchRow
                  batch={batch}
                  expanded={expandedBatch === batch.requestId}
                  onToggle={() =>
                    setExpandedBatch((current) =>
                      current === batch.requestId ? "" : batch.requestId,
                    )
                  }
                  t={t}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function BatchRow({
  batch,
  expanded,
  onToggle,
  t,
}: {
  batch: RecentBatch;
  expanded: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const relativeLabels = relativeTimeLabels(t);
  const failed = batch.results.filter((result) => !result.ok).length;
  const ok = batch.results.length - failed;
  return (
    <div className={`batch-row ${failed > 0 ? "is-warn" : "is-ok"} ${expanded ? "is-open" : ""}`}>
      <button aria-expanded={expanded} className="batch-row__head" type="button" onClick={onToggle}>
        <code>{batch.requestId}</code>
        <span>
          {batch.calls.length} {t("batch.calls")}
        </span>
        <StatusPill tone="good">{ok} ok</StatusPill>
        {failed > 0 ? <StatusPill tone="bad">{failed} err</StatusPill> : null}
        <span>{formatMs(batch.durationMs)}</span>
        <span>{formatRelative(batch.requestedAt, relativeLabels)}</span>
      </button>
      {expanded ? (
        <div className="batch-row__body">
          <p>
            {t("batch.options")}: failFast={String(batch.options?.failFast ?? false)} · timeoutMs=
            {batch.options?.timeoutMs ?? "n/a"}
          </p>
          <div className="batch-result-table">
            <div className="batch-result-table__row is-head">
              <span>{t("batch.id")}</span>
              <span>{t("batch.method")}</span>
              <span>{t("batch.status")}</span>
              <span>{t("batch.resultOrError")}</span>
            </div>
            {batch.calls.map((call) => (
              <BatchResultRow
                call={call}
                key={call.id}
                result={batch.results.find((result) => result.id === call.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BatchResultRow({
  call,
  result,
}: {
  call: DeckGoGatewayBatchCall;
  result: DeckGoGatewayBatchResultEntry | undefined;
}) {
  return (
    <div className="batch-result-table__row">
      <code>{call.id}</code>
      <code>{call.method}</code>
      <span className={result?.ok ? "td-tag td-tag--ok" : "td-tag td-tag--error"}>
        {result?.ok ? "ok" : result?.error?.code || "err"}
      </span>
      <code>
        {result?.ok ? jsonBlock(result.result) || "n/a" : result?.error?.message || "n/a"}
      </code>
    </div>
  );
}

function ActivityList({
  events,
  monitorRuns,
  monitorStats,
  projectionError,
  t,
}: {
  events: DeckGoActivityEvent[];
  monitorRuns: DeckGoMonitorRun[];
  monitorStats: DeckGoMonitorStatsResponse | null;
  projectionError: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const relativeLabels = relativeTimeLabels(t);
  return (
    <article className="activity-list gateway-card">
      <header className="gateway-card__header">
        <div>
          <h3>{t("activity.title")}</h3>
          <p>{t("activity.hint")}</p>
        </div>
        <StatusPill>{events.length}</StatusPill>
      </header>
      <div className="activity-list__stats">
        <FieldRow
          label={t("stats.totalRuns")}
          value={monitorStats?.totalRuns ?? monitorRuns.length}
        />
        <FieldRow label={t("stats.todayRuns")} value={monitorStats?.todayRuns ?? 0} />
        <FieldRow label={t("stats.avgDuration")} value={formatMs(monitorStats?.avgDurationMs)} />
      </div>
      {projectionError && !isGatewayNotConfiguredValue(projectionError) ? (
        <p className="gateway-error" role="alert">
          {projectionError}
        </p>
      ) : null}
      {events.length === 0 ? (
        <p className="gateway-empty-text">{t("activity.noActivity")}</p>
      ) : (
        <ul className="activity-list__rows" role="list">
          {events.map((event) => (
            <li className="activity-row" key={event.id}>
              <span>{formatTimestamp(event.timestamp)}</span>
              <span>{formatRelative(event.timestamp, relativeLabels)}</span>
              <span>{event.agentName || event.agentId || t("runtime.gateway")}</span>
              <code>{event.type}</code>
              <span>{event.description || event.type}</span>
              <code>{event.details || "n/a"}</code>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function RuntimeFacts({
  boolLabels,
  bundledRuntime,
  gatewayConnected,
  gatewayUrl,
  remoteRuntime,
  runtimeConfigured,
  runtimeHealth,
  runtimeMode,
  runtimeStatus,
  supervisorState,
  t,
}: {
  boolLabels: { no: string; unknown: string; yes: string };
  bundledRuntime: DeckGoBundledRuntimeGatewayStatus | null;
  gatewayConnected: boolean;
  gatewayUrl: string;
  remoteRuntime: DeckGoRemoteRuntimeGatewayStatus | null;
  runtimeConfigured: boolean | undefined;
  runtimeHealth: string;
  runtimeMode: string;
  runtimeStatus: string;
  supervisorState: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <article className="gateway-runtime-facts gateway-card">
      <header className="gateway-card__header">
        <div>
          <h3>{t("runtime.title")}</h3>
          <p>{supervisorState ? t("runtime.bundledState") : t("runtime.remoteState")}</p>
        </div>
        <StatusPill tone={boolTone(gatewayConnected)}>
          {t("runtime.gateway")} {gatewayConnected ? t("connected") : t("runtime.pending")}
        </StatusPill>
      </header>
      <div className="gateway-field-grid">
        <FieldRow label={t("runtime.mode")} value={runtimeMode} />
        <FieldRow label={t("runtime.status")} value={runtimeStatus} />
        <FieldRow label={t("runtime.health")} value={runtimeHealth} />
        <FieldRow
          label={t("runtime.configured")}
          value={formatBool(runtimeConfigured, boolLabels)}
        />
        {supervisorState ? (
          <>
            <FieldRow label={t("runtime.pid")} value={bundledRuntime?.pid ?? "n/a"} />
            <FieldRow
              label={t("runtime.ownership")}
              value={bundledRuntime?.ownershipState || "none"}
            />
            <FieldRow
              label={t("runtime.restartAttempts")}
              value={bundledRuntime?.restartAttempts ?? 0}
            />
            <FieldRow
              label={t("runtime.autoStart")}
              value={formatBool(bundledRuntime?.autoStart, boolLabels)}
            />
          </>
        ) : (
          <>
            <FieldRow
              label={t("runtime.lastConnectedAt")}
              value={remoteRuntime?.lastConnectedAt || "n/a"}
            />
            <FieldRow
              label={t("runtime.latencyP50")}
              value={remoteRuntime?.latencyP50 != null ? `${remoteRuntime.latencyP50} ms` : "n/a"}
            />
            <FieldRow
              label={t("runtime.tlsVerified")}
              value={formatBool(remoteRuntime?.tlsVerified, boolLabels)}
            />
            <FieldRow
              label={t("runtime.lastError")}
              value={remoteRuntime?.lastError || t("runtime.none")}
            />
          </>
        )}
        <FieldRow label={t("runtime.resolvedUrl")} value={gatewayUrl} />
      </div>
    </article>
  );
}
