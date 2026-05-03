import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  fetchActivityEvents,
  fetchGatewayHealth,
  fetchGatewayStatus,
  fetchMonitorRunDetail,
  fetchMonitorRuns,
  fetchMonitorStats,
  isBundledRuntimeStatus,
  isRemoteRuntimeStatus,
  type DeckGoActivityEvent,
  type DeckGoGatewayHealthResponse,
  type DeckGoGatewayStatusResponse,
  type DeckGoMonitorRun,
  type DeckGoMonitorRunDetailResponse,
  type DeckGoMonitorStatsResponse,
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

type GatewayTab = "overview" | "timeline" | "history" | "runtime";
type MetricTone = "good" | "warn" | "bad" | "neutral";

const GATEWAY_TABS: Array<{ key: GatewayTab; labelKey: string }> = [
  { key: "overview", labelKey: "tabs.overview" },
  { key: "timeline", labelKey: "tabs.timeline" },
  { key: "history", labelKey: "tabs.history" },
  { key: "runtime", labelKey: "tabs.runtime" },
];

function countRecordEntries(value: Record<string, unknown> | undefined) {
  return value ? Object.keys(value).length : 0;
}

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

function channelCountFromStatus(status: DeckGoGatewayStatusResponse | null) {
  const direct = countRecordEntries(status?.channels);
  if (direct > 0) {
    return direct;
  }
  return Array.isArray(status?.channelSummary) ? status.channelSummary.length : 0;
}

function formatHeartbeatSummary(
  value: DeckGoGatewayStatusResponse["heartbeat"],
  labels: { defaultAgent: string; enabled: string; unknown: string },
) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return labels.unknown;
  }
  const agents = Array.isArray(value.agents) ? value.agents : [];
  const enabled = agents.filter((agent) => {
    const enabledValue =
      typeof agent === "object" && agent != null
        ? (agent as { enabled?: boolean }).enabled
        : undefined;
    return enabledValue !== false;
  }).length;
  const defaultAgent = value.defaultAgentId?.trim();
  const cadence = agents
    .map((agent) =>
      typeof agent === "object" && agent != null ? (agent as { every?: string }).every : undefined,
    )
    .find((every) => typeof every === "string" && every.trim())
    ?.trim();
  const parts = [`${enabled}/${agents.length} ${labels.enabled}`];
  if (defaultAgent) {
    parts.push(`${labels.defaultAgent} ${defaultAgent}`);
  }
  if (cadence) {
    parts.push(cadence);
  }
  return parts.join(" | ");
}

function formatMonitorTimestamp(value: string | undefined | null) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatEventTimestamp(value: number | undefined | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return new Date(value).toLocaleString();
}

function formatMonitorDuration(ms: number | undefined | null) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) {
    return "n/a";
  }
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function summarizeRunEvent(event: { stream?: string; data?: string }) {
  if (!event.data) {
    return event.stream || "event";
  }
  try {
    const parsed = JSON.parse(event.data) as Record<string, unknown>;
    const type = typeof parsed.type === "string" ? parsed.type : "";
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.description === "string"
          ? parsed.description
          : "";
    return [type || event.stream, message].filter(Boolean).join(" | ") || event.data;
  } catch {
    return event.data;
  }
}

function metricToneClass(tone: MetricTone) {
  return `gateway-metric is-${tone}`;
}

function pillToneClass(tone: MetricTone) {
  return `gateway-pill is-${tone}`;
}

function runtimeTone(value: string | undefined) {
  if (value === "running" || value === "healthy" || value === "active") {
    return "good" satisfies MetricTone;
  }
  if (value === "starting" || value === "stopping" || value === "degraded") {
    return "warn" satisfies MetricTone;
  }
  if (value === "failed" || value === "unhealthy" || value === "error") {
    return "bad" satisfies MetricTone;
  }
  return "neutral" satisfies MetricTone;
}

function boolTone(value: boolean | undefined) {
  if (value === true) {
    return "good" satisfies MetricTone;
  }
  if (value === false) {
    return "warn" satisfies MetricTone;
  }
  return "neutral" satisfies MetricTone;
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

function FieldRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="gateway-field-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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

export function GatewayPanel() {
  const t = useTranslations("monitor");
  const [activeTab, setActiveTab] = useState<GatewayTab>("overview");
  const { bootstrap, runtime, refreshingSummary, refreshRuntimeSummary } = useDeckUI();
  const { capabilities } = useCapabilities();
  const [healthResponse, setHealthResponse] = useState<DeckGoGatewayHealthResponse | null>(null);
  const [statusResponse, setStatusResponse] = useState<DeckGoGatewayStatusResponse | null>(null);
  const [activityEvents, setActivityEvents] = useState<DeckGoActivityEvent[]>([]);
  const [monitorRuns, setMonitorRuns] = useState<DeckGoMonitorRun[]>([]);
  const [monitorStats, setMonitorStats] = useState<DeckGoMonitorStatsResponse | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [monitorRunDetail, setMonitorRunDetail] = useState<DeckGoMonitorRunDetailResponse | null>(
    null,
  );
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const [monitorError, setMonitorError] = useState("");

  const refreshDiagnostics = useCallback(async () => {
    try {
      const [health, status] = await Promise.all([fetchGatewayHealth(), fetchGatewayStatus()]);
      setHealthResponse(health);
      setStatusResponse(status);
      setDiagnosticsError("");
    } catch (loadError) {
      setDiagnosticsError(gatewayNotConfiguredValue(loadError, t("errors.loadDiagnostics")));
    }
  }, [t]);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  const refreshMonitor = useCallback(async () => {
    try {
      const [activity, runs, stats] = await Promise.all([
        fetchActivityEvents(20),
        fetchMonitorRuns({ limit: 20 }),
        fetchMonitorStats(),
      ]);
      setActivityEvents(activity.events ?? []);
      setMonitorRuns(runs.runs ?? []);
      setMonitorStats(stats);
      setMonitorError("");
    } catch (loadError) {
      setMonitorError(gatewayNotConfiguredValue(loadError, t("errors.loadMonitorProjections")));
    }
  }, [t]);

  useEffect(() => {
    void refreshMonitor();
  }, [refreshMonitor]);

  const loadRunDetail = async (runId: string) => {
    try {
      setSelectedRunId(runId);
      const detail = await fetchMonitorRunDetail(runId);
      setMonitorRunDetail(detail);
      setMonitorError("");
    } catch (loadError) {
      setMonitorError(loadError instanceof Error ? loadError.message : t("errors.loadRunDetail"));
    }
  };

  const refreshWorkbench = () => {
    void refreshRuntimeSummary();
    void refreshDiagnostics();
    void refreshMonitor();
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
  const supervisorState = capabilities?.supervisorState ?? runtimePayload?.mode !== "remote";
  const runtimeMode =
    capabilities?.mode ?? runtimePayload?.mode ?? bootstrapRuntime?.mode ?? "unknown";
  const runtimeConfigured =
    capabilities?.configured ?? runtimePayload?.configured ?? bootstrapRuntime?.configured;
  const runtimeStatus = runtimePayload?.status || bootstrapRuntime?.status || "unknown";
  const runtimeHealth = runtimePayload?.health || bootstrapRuntime?.health || "unknown";
  const runtimeOwnership = bundledRuntime?.ownershipState || "none";
  const restartAttempts = bundledRuntime?.restartAttempts ?? 0;
  const gatewayUrl =
    runtimePayload?.gatewayUrl || bootstrapRuntime?.gatewayUrl || t("runtime.notResolved");
  const gatewayConnected =
    bootstrap?.gateway.connected ||
    (remoteRuntime?.lastConnectedAt != null && !remoteRuntime.lastError);
  const healthChannelCount = countRecordEntries(healthResponse?.channels);
  const statusChannelCount = channelCountFromStatus(statusResponse);
  const selectedRun = monitorRuns.find((run) => run.runId === selectedRunId) ?? null;
  const latestRun = selectedRun ?? monitorRuns[0] ?? null;
  const gatewayNotConfigured =
    isGatewayNotConfiguredValue(diagnosticsError) || isGatewayNotConfiguredValue(monitorError);
  const diagnosticsHealth =
    healthResponse?.ok === false
      ? t("runtime.no")
      : healthResponse
        ? t("runtime.yes")
        : t("runtime.unknown");
  const healthLatency =
    typeof healthResponse?.durationMs === "number" ? `${healthResponse.durationMs} ms` : "n/a";
  const statusHeartbeat = formatHeartbeatSummary(statusResponse?.heartbeat, {
    defaultAgent: t("overview.defaultAgent"),
    enabled: t("overview.enabled"),
    unknown: t("runtime.unknown"),
  });
  const statusStateLabel = statusResponse?.state
    ? t("overview.state")
    : t("workbench.runtimeVersion");
  const statusStateValue =
    statusResponse?.state || statusResponse?.runtimeVersion || t("runtime.unknown");
  const boolLabels = {
    no: t("runtime.no"),
    unknown: t("runtime.unknown"),
    yes: t("runtime.yes"),
  };

  return (
    <section className="gateway-panel" data-testid="gateway-panel">
      <header className="gateway-panel__header">
        <div>
          <p className="gateway-eyebrow">{t("workbench.eyebrow")}</p>
          <h2>{t("workbench.title")}</h2>
          <p className="gateway-note">{t("overview.description")}</p>
        </div>
        <div className="gateway-header-actions">
          <StatusPill tone={runtimeTone(runtimeStatus)}>
            {t("runtime.status")} {runtimeStatus}
          </StatusPill>
          <StatusPill tone={boolTone(gatewayConnected)}>
            {t("runtime.gateway")} {gatewayConnected ? t("connected") : t("runtime.pending")}
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

      <div className="gateway-metrics" aria-label={t("workbench.metrics")}>
        <MetricTile
          detail={`${t("runtime.mode")} ${runtimeMode}`}
          label={t("runtime.status")}
          tone={runtimeTone(runtimeStatus)}
          value={runtimeStatus}
        />
        <MetricTile
          detail={`${t("workbench.diagnostics")} ${diagnosticsHealth}`}
          label={t("runtime.health")}
          tone={runtimeTone(runtimeHealth)}
          value={runtimeHealth}
        />
        <MetricTile
          detail={gatewayUrl}
          label={t("workbench.connectivity")}
          tone={boolTone(gatewayConnected)}
          value={gatewayConnected ? t("connected") : t("runtime.pending")}
        />
        <MetricTile
          detail={`${t("stats.todayRuns")} ${monitorStats?.todayRuns ?? 0}`}
          label={t("workbench.monitorRuns")}
          tone={monitorRuns.length > 0 ? "good" : "neutral"}
          value={monitorStats?.totalRuns ?? monitorRuns.length}
        />
        <MetricTile
          detail={activityEvents[0]?.description ?? t("noEvents")}
          label={t("workbench.activityEvents")}
          tone={activityEvents.length > 0 ? "good" : "neutral"}
          value={activityEvents.length}
        />
      </div>

      <div className="gateway-tabs" role="tablist">
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
          </button>
        ))}
      </div>

      <div
        className="gateway-workbench"
        hidden={activeTab !== "overview"}
        id="deck-ui-gateway-overview"
        role="tabpanel"
      >
        <div className="gateway-column">
          <article className="gateway-card">
            <div className="gateway-card__header">
              <div>
                <h3>{t("runtime.summaryTitle")}</h3>
                <p>{supervisorState ? t("runtime.bundledState") : t("runtime.remoteState")}</p>
              </div>
              <StatusPill tone={boolTone(runtimeConfigured)}>
                {t("runtime.configured")} {formatBool(runtimeConfigured, boolLabels)}
              </StatusPill>
            </div>
            <div className="gateway-card__body">
              <RuntimeStatusStrip
                autoStart={bundledRuntime?.autoStart}
                boolLabels={boolLabels}
                gatewayConnected={gatewayConnected}
                gatewayUrl={gatewayUrl}
                refreshState={refreshingSummary ? t("runtime.inFlight") : t("runtime.idle")}
                restartAttempts={restartAttempts}
                runtimeHealth={runtimeHealth}
                runtimeMode={runtimeMode}
                runtimeOwnership={runtimeOwnership}
                runtimeStatus={runtimeStatus}
                supervisorState={supervisorState}
                t={t}
              />

              {gatewayNotConfigured ? (
                <GatewayNotConfiguredEmptyState className="gateway-empty" />
              ) : (
                <>
                  <div className="gateway-diagnostics">
                    <DiagnosticTile
                      body={`${t("overview.ok")}: ${diagnosticsHealth} | ${t(
                        "latency",
                      )}: ${healthLatency}`}
                      detail={`${t("overview.agents")}: ${healthResponse?.agents?.length ?? 0} | ${t(
                        "sessions",
                      )}: ${sessionCountFromHealth(healthResponse)} | ${t(
                        "channels",
                      )}: ${healthChannelCount}`}
                      label={t("overview.healthDiagnostics")}
                    />
                    <DiagnosticTile
                      body={`${statusStateLabel}: ${statusStateValue} | ${t(
                        "heartbeat",
                      )}: ${statusHeartbeat}`}
                      detail={`${t("sessions")}: ${sessionCountFromStatus(
                        statusResponse?.sessions,
                      )} | ${t("channels")}: ${statusChannelCount}`}
                      label={t("overview.statusSummary")}
                    />
                  </div>
                  {diagnosticsError && !isGatewayNotConfiguredValue(diagnosticsError) ? (
                    <p className="gateway-error" role="alert">
                      {diagnosticsError}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </article>

          <ActivityFeed
            events={activityEvents}
            gatewayLabel={t("runtime.gateway")}
            noEventsLabel={t("noEvents")}
            title={t("liveFeed")}
          />
        </div>

        <aside className="gateway-column">
          <MonitorHistoryCard
            compact
            formatTimestamp={formatMonitorTimestamp}
            monitorRuns={monitorRuns.slice(0, 5)}
            noRunsLabel={t("history.noRuns")}
            onSelectRun={(runId) => {
              setActiveTab("timeline");
              void loadRunDetail(runId);
            }}
            selectedRunId={selectedRunId}
            t={t}
            title={t("workbench.monitorEvidence")}
          />

          <article className="gateway-card">
            <div className="gateway-card__header">
              <div>
                <h3>{t("workbench.selectedTimeline")}</h3>
                <p>{latestRun ? latestRun.runId : t("timeline.selectRun")}</p>
              </div>
              {latestRun ? (
                <StatusPill tone={runtimeTone(latestRun.status)}>{latestRun.status}</StatusPill>
              ) : null}
            </div>
            <div className="gateway-card__body">
              {latestRun ? (
                <TimelineSummaryGrid
                  durationMs={monitorRunDetail?.summary?.durationMs}
                  fileOps={monitorRunDetail?.summary?.fileOps}
                  modelCalls={monitorRunDetail?.summary?.modelCalls ?? latestRun.modelCalls}
                  subagentSpawns={monitorRunDetail?.summary?.subagentSpawns}
                  t={t}
                  toolCalls={monitorRunDetail?.summary?.toolCalls ?? latestRun.toolCalls}
                  totalTokens={monitorRunDetail?.summary?.totalTokens ?? latestRun.totalTokens}
                  eventCount={monitorRunDetail?.summary?.eventCount ?? latestRun.eventCount}
                />
              ) : (
                <p className="gateway-empty-text">{t("timeline.selectRun")}</p>
              )}
            </div>
          </article>
        </aside>
      </div>

      <div
        className="gateway-workbench is-single"
        hidden={activeTab !== "runtime"}
        id="deck-ui-gateway-runtime"
        role="tabpanel"
      >
        <article className="gateway-card">
          <div className="gateway-card__header">
            <div>
              <h3>{t("runtime.title")}</h3>
              <p>{t("runtime.summaryDescription")}</p>
            </div>
            <button
              className="gateway-button"
              disabled={refreshingSummary}
              type="button"
              onClick={refreshWorkbench}
            >
              {t("runtime.refresh")}
            </button>
          </div>
          <div className="gateway-card__body">
            <RuntimeStatusStrip
              autoStart={bundledRuntime?.autoStart}
              boolLabels={boolLabels}
              gatewayConnected={gatewayConnected}
              gatewayUrl={gatewayUrl}
              refreshState={refreshingSummary ? t("runtime.inFlight") : t("runtime.idle")}
              restartAttempts={restartAttempts}
              runtimeHealth={runtimeHealth}
              runtimeMode={runtimeMode}
              runtimeOwnership={runtimeOwnership}
              runtimeStatus={runtimeStatus}
              supervisorState={supervisorState}
              t={t}
            />
            {supervisorState ? (
              <div className="gateway-field-grid">
                <FieldRow label={t("runtime.bundledState")} value={runtimeStatus} />
                <FieldRow label={t("runtime.pid")} value={bundledRuntime?.pid ?? "n/a"} />
                <FieldRow label={t("runtime.ownership")} value={runtimeOwnership} />
                <FieldRow label={t("runtime.restartAttempts")} value={restartAttempts} />
                <FieldRow
                  label={t("runtime.configured")}
                  value={formatBool(runtimeConfigured, boolLabels)}
                />
                <FieldRow label={t("runtime.resolvedUrl")} value={gatewayUrl} />
              </div>
            ) : (
              <div className="gateway-field-grid">
                <FieldRow label={t("runtime.remoteState")} value={runtimeStatus} />
                <FieldRow
                  label={t("runtime.lastConnectedAt")}
                  value={remoteRuntime?.lastConnectedAt || "n/a"}
                />
                <FieldRow
                  label={t("runtime.latencyP50")}
                  value={
                    remoteRuntime?.latencyP50 != null ? `${remoteRuntime.latencyP50} ms` : "n/a"
                  }
                />
                <FieldRow
                  label={t("runtime.tlsVerified")}
                  value={formatBool(remoteRuntime?.tlsVerified, boolLabels)}
                />
                <FieldRow
                  label={t("runtime.lastError")}
                  value={remoteRuntime?.lastError || t("runtime.none")}
                />
                <FieldRow label={t("runtime.resolvedUrl")} value={gatewayUrl} />
              </div>
            )}
          </div>
        </article>
      </div>

      <div
        className="gateway-workbench is-single"
        hidden={activeTab !== "history"}
        id="deck-ui-gateway-history"
        role="tabpanel"
      >
        <MonitorHistoryCard
          formatTimestamp={formatMonitorTimestamp}
          monitorRuns={monitorRuns}
          monitorStats={monitorStats}
          noRunsLabel={t("history.noRuns")}
          onSelectRun={(runId) => {
            setActiveTab("timeline");
            void loadRunDetail(runId);
          }}
          selectedRunId={selectedRunId}
          t={t}
          title={t("tabs.history")}
        />
        {monitorError && !isGatewayNotConfiguredValue(monitorError) ? (
          <p className="gateway-error" role="alert">
            {monitorError}
          </p>
        ) : null}
      </div>

      <div
        className="gateway-workbench is-single"
        hidden={activeTab !== "timeline"}
        id="deck-ui-gateway-timeline"
        role="tabpanel"
      >
        <article className="gateway-card">
          <div className="gateway-card__header">
            <div>
              <h3>{t("timeline.ganttTitle")}</h3>
              <p>{selectedRun ? selectedRun.runId : t("timeline.selectRun")}</p>
            </div>
            {selectedRun ? (
              <StatusPill tone={runtimeTone(selectedRun.status)}>{selectedRun.status}</StatusPill>
            ) : null}
          </div>
          <div className="gateway-card__body">
            {selectedRun ? (
              <>
                <div className="gateway-surface gateway-selected-run">
                  <p className="gateway-eyebrow">{t("timeline.run")}</p>
                  <strong>{selectedRun.runId}</strong>
                  <p className="gateway-note">
                    {selectedRun.agentId || t("history.unknownAgent")} |{" "}
                    {selectedRun.sessionKey || t("timeline.unknownSession")} |{" "}
                    {formatMonitorTimestamp(selectedRun.lastEventAt)}
                  </p>
                </div>
                <TimelineSummaryGrid
                  durationMs={monitorRunDetail?.summary?.durationMs}
                  eventCount={monitorRunDetail?.summary?.eventCount ?? selectedRun.eventCount}
                  fileOps={monitorRunDetail?.summary?.fileOps}
                  modelCalls={monitorRunDetail?.summary?.modelCalls ?? selectedRun.modelCalls}
                  subagentSpawns={monitorRunDetail?.summary?.subagentSpawns}
                  t={t}
                  toolCalls={monitorRunDetail?.summary?.toolCalls ?? selectedRun.toolCalls}
                  totalTokens={monitorRunDetail?.summary?.totalTokens ?? selectedRun.totalTokens}
                />
                <div className="gateway-card__section">
                  <div className="gateway-section-heading">
                    <h3>{t("timeline.runEvents")}</h3>
                    <span>{(monitorRunDetail?.events ?? []).length}</span>
                  </div>
                  {(monitorRunDetail?.events ?? []).length === 0 ? (
                    <p className="gateway-empty-text">{t("noEvents")}</p>
                  ) : (
                    <ul className="gateway-list">
                      {(monitorRunDetail?.events ?? []).slice(0, 12).map((event) => (
                        <li key={event.id}>
                          <div className="gateway-timeline-row">
                            <code>#{event.seq}</code>
                            <div>
                              <strong>{event.stream}</strong>
                              <p className="gateway-meta">
                                {formatMonitorTimestamp(event.created_at)}
                              </p>
                              <p className="gateway-meta">{summarizeRunEvent(event)}</p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="gateway-surface">
                <p className="gateway-eyebrow">{t("timeline.ganttTitle")}</p>
                <p className="gateway-empty-text">{t("timeline.selectRun")}</p>
              </div>
            )}
            {monitorError && !isGatewayNotConfiguredValue(monitorError) ? (
              <p className="gateway-error" role="alert">
                {monitorError}
              </p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

function RuntimeStatusStrip({
  autoStart,
  boolLabels,
  gatewayConnected,
  gatewayUrl,
  refreshState,
  restartAttempts,
  runtimeHealth,
  runtimeMode,
  runtimeOwnership,
  runtimeStatus,
  supervisorState,
  t,
}: {
  autoStart?: boolean;
  boolLabels: { no: string; unknown: string; yes: string };
  gatewayConnected: boolean;
  gatewayUrl: string;
  refreshState: string;
  restartAttempts: number;
  runtimeHealth: string;
  runtimeMode: string;
  runtimeOwnership: string;
  runtimeStatus: string;
  supervisorState: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="gateway-status-strip">
      <StatusPill tone={runtimeTone(runtimeStatus)}>
        {t("runtime.status")} {runtimeStatus}
      </StatusPill>
      <StatusPill tone={runtimeTone(runtimeHealth)}>
        {t("runtime.health")} {runtimeHealth}
      </StatusPill>
      <StatusPill tone={boolTone(gatewayConnected)}>
        {t("runtime.gateway")} {gatewayConnected ? t("connected") : t("runtime.pending")}
      </StatusPill>
      <StatusPill>
        {t("runtime.mode")} {runtimeMode}
      </StatusPill>
      <StatusPill>
        {t("runtime.refreshState")} {refreshState}
      </StatusPill>
      {supervisorState ? (
        <>
          <StatusPill>
            {t("runtime.ownership")} {runtimeOwnership}
          </StatusPill>
          <StatusPill>
            {t("runtime.restartAttempts")} {restartAttempts}
          </StatusPill>
          <StatusPill>
            {t("runtime.autoStart")} {formatBool(autoStart, boolLabels)}
          </StatusPill>
        </>
      ) : null}
      <code className="gateway-url">{gatewayUrl}</code>
    </div>
  );
}

function DiagnosticTile({ body, detail, label }: { body: string; detail: string; label: string }) {
  return (
    <div className="gateway-surface">
      <p className="gateway-eyebrow">{label}</p>
      <strong>{body}</strong>
      <p className="gateway-meta">{detail}</p>
    </div>
  );
}

function ActivityFeed({
  events,
  gatewayLabel,
  noEventsLabel,
  title,
}: {
  events: DeckGoActivityEvent[];
  gatewayLabel: string;
  noEventsLabel: string;
  title: string;
}) {
  return (
    <article className="gateway-card">
      <div className="gateway-card__header">
        <div>
          <h3>{title}</h3>
          <p>{events.length} events</p>
        </div>
      </div>
      <div className="gateway-card__body">
        {events.length === 0 ? (
          <p className="gateway-empty-text">{noEventsLabel}</p>
        ) : (
          <ul className="gateway-list">
            {events.slice(0, 6).map((event) => (
              <li key={event.id}>
                <div className="gateway-activity-row">
                  <span className={pillToneClass("neutral")}>{event.type}</span>
                  <div>
                    <strong>{event.description || event.type}</strong>
                    <p className="gateway-meta">
                      {event.agentName || event.agentId || gatewayLabel} |{" "}
                      {formatEventTimestamp(event.timestamp)}
                    </p>
                    {event.details ? <p className="gateway-meta">{event.details}</p> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function MonitorHistoryCard({
  compact = false,
  formatTimestamp,
  monitorRuns,
  monitorStats,
  noRunsLabel,
  onSelectRun,
  selectedRunId,
  t,
  title,
}: {
  compact?: boolean;
  formatTimestamp: (value: string | undefined | null) => string;
  monitorRuns: DeckGoMonitorRun[];
  monitorStats?: DeckGoMonitorStatsResponse | null;
  noRunsLabel: string;
  onSelectRun: (runId: string) => void;
  selectedRunId: string;
  t: ReturnType<typeof useTranslations>;
  title: string;
}) {
  return (
    <article className="gateway-card">
      <div className="gateway-card__header">
        <div>
          <h3>{title}</h3>
          <p>{compact ? t("workbench.latestRun") : t("history.description")}</p>
        </div>
        <StatusPill tone={monitorRuns.length > 0 ? "good" : "neutral"}>
          {monitorStats?.totalRuns ?? monitorRuns.length}
        </StatusPill>
      </div>
      <div className="gateway-card__body">
        {!compact && monitorStats ? (
          <div className="gateway-stats">
            <FieldRow label={t("stats.totalRuns")} value={monitorStats.totalRuns} />
            <FieldRow label={t("stats.todayRuns")} value={monitorStats.todayRuns} />
            <FieldRow
              label={t("stats.avgDuration")}
              value={formatMonitorDuration(monitorStats.avgDurationMs)}
            />
          </div>
        ) : null}
        {monitorRuns.length === 0 ? (
          <p className="gateway-empty-text">{noRunsLabel}</p>
        ) : (
          <ul className="gateway-list">
            {monitorRuns.map((run) => (
              <li key={run.runId}>
                <button
                  aria-pressed={selectedRunId === run.runId}
                  className={`gateway-run-row ${selectedRunId === run.runId ? "is-selected" : ""}`}
                  type="button"
                  onClick={() => onSelectRun(run.runId)}
                >
                  <span className="gateway-run-top">
                    <strong>{run.runId}</strong>
                    <StatusPill tone={runtimeTone(run.status)}>{run.status}</StatusPill>
                  </span>
                  <span className="gateway-meta">
                    {t("overview.agent")} {run.agentId || "n/a"} | {t("sessions")}{" "}
                    {run.sessionKey || "n/a"}
                  </span>
                  <span className="gateway-meta">
                    {t("timeline.events")} {run.eventCount} | {t("timeline.tools")} {run.toolCalls}{" "}
                    | {t("timeline.models")} {run.modelCalls} | {t("timeline.tokens")}{" "}
                    {run.totalTokens}
                  </span>
                  {!compact ? (
                    <span className="gateway-meta">{formatTimestamp(run.lastEventAt)}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function TimelineSummaryGrid({
  durationMs,
  eventCount,
  fileOps,
  modelCalls,
  subagentSpawns,
  t,
  toolCalls,
  totalTokens,
}: {
  durationMs?: number;
  eventCount?: number;
  fileOps?: number;
  modelCalls?: number;
  subagentSpawns?: number;
  t: ReturnType<typeof useTranslations>;
  toolCalls?: number;
  totalTokens?: number;
}) {
  return (
    <div className="gateway-stats">
      <FieldRow
        label={t("timeline.ganttTitle")}
        value={`${eventCount ?? 0} / ${formatMonitorDuration(durationMs)}`}
      />
      <FieldRow
        label={t("timeline.toolWaterfallTitle")}
        value={`${toolCalls ?? 0} / ${t("timeline.modelCalls")} ${modelCalls ?? 0}`}
      />
      <FieldRow label={t("timeline.modelStatsTitle")} value={totalTokens ?? 0} />
      <FieldRow
        label={t("timeline.fileChangesTitle")}
        value={`${t("timeline.fileOps")} ${fileOps ?? 0} | ${t("timeline.subagentSpawns")} ${
          subagentSpawns ?? 0
        }`}
      />
    </div>
  );
}
