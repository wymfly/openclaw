import { useCallback, useEffect, useState } from "react";
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

type GatewayTab = "overview" | "timeline" | "history" | "runtime";

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
  return (health?.agents ?? []).reduce((sum, agent) => sum + (agent.sessions?.count ?? 0), 0);
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
  const enabled = agents.filter((agent) => agent.enabled !== false).length;
  const defaultAgent = value.defaultAgentId?.trim();
  const cadence = agents.find((agent) => agent.every?.trim())?.every?.trim();
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

  const runtimePayload = runtime?.runtime;
  const bootstrapRuntime = bootstrap?.runtime;
  const bundledRuntime = isBundledRuntimeStatus(runtimePayload)
    ? runtimePayload
    : isBundledRuntimeStatus(bootstrapRuntime)
      ? bootstrapRuntime
      : null;
  const remoteRuntime = isRemoteRuntimeStatus(runtimePayload) ? runtimePayload : null;
  const supervisorState = capabilities?.supervisorState ?? runtimePayload?.mode !== "remote";
  const runtimeStatus = runtimePayload?.status || bootstrap?.runtime.status || "unknown";
  const runtimeHealth = runtimePayload?.health || bootstrap?.runtime.health || "unknown";
  const runtimeOwnership = bundledRuntime?.ownershipState || "none";
  const restartAttempts = bundledRuntime?.restartAttempts ?? 0;
  const gatewayUrl = runtimePayload?.gatewayUrl || t("runtime.notResolved");
  const healthChannelCount = countRecordEntries(healthResponse?.channels);
  const statusChannelCount = countRecordEntries(statusResponse?.channels);
  const selectedRun = monitorRuns.find((run) => run.runId === selectedRunId) ?? null;
  const gatewayNotConfigured =
    isGatewayNotConfiguredValue(diagnosticsError) || isGatewayNotConfiguredValue(monitorError);

  return (
    <section className="deckgo-panel-workspace deck-ui-gateway">
      <div className="deck-ui-gateway-tabs deck-ui-tab-strip" role="tablist">
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
        className="deckgo-column deck-ui-gateway-column"
        hidden={activeTab !== "overview" && activeTab !== "runtime"}
        id={activeTab === "runtime" ? "deck-ui-gateway-runtime" : "deck-ui-gateway-overview"}
        role="tabpanel"
      >
        <article className="deckgo-card is-float deck-ui-gateway-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">
              {activeTab === "runtime" ? t("runtime.title") : t("title")}
            </h2>
          </div>
          <p className="deckgo-card-subtitle">
            {activeTab === "runtime" ? t("runtime.description") : t("overview.description")}
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-gateway-body">
            <div className="deckgo-pill-row deck-ui-gateway-status-row">
              <span
                className={`deckgo-pill ${runtimeStatus === "running" ? "is-positive" : "is-muted"}`}
              >
                {t("runtime.status")} {runtimeStatus}
              </span>
              <span
                className={`deckgo-pill ${runtimeHealth === "healthy" ? "is-positive" : "is-muted"}`}
              >
                {t("runtime.health")} {runtimeHealth}
              </span>
              <span className="deckgo-pill">
                {t("runtime.gateway")}{" "}
                {bootstrap?.gateway.connected ? t("connected") : t("runtime.pending")}
              </span>
              <span className="deckgo-pill">
                {t("runtime.refreshState")}{" "}
                {refreshingSummary ? t("runtime.inFlight") : t("runtime.idle")}
              </span>
              {supervisorState ? (
                <>
                  <span className="deckgo-pill">
                    {t("runtime.ownership")} {runtimeOwnership}
                  </span>
                  <span className="deckgo-pill">
                    {t("runtime.restartAttempts")} {restartAttempts}
                  </span>
                </>
              ) : (
                <span className="deckgo-pill">
                  {t("runtime.mode")} {capabilities?.mode ?? runtimePayload?.mode ?? "remote"}
                </span>
              )}
            </div>

            <div className="deckgo-panel-hero-strip deck-ui-gateway-hero">
              <div>
                <p className="deckgo-kicker">{t("runtime.resolvedUrl")}</p>
                <strong>{gatewayUrl}</strong>
                <p className="deckgo-note">
                  {supervisorState
                    ? `${t("runtime.pid")}: ${bundledRuntime?.pid ?? "n/a"} | ${t(
                        "runtime.configured",
                      )}: ${runtimePayload?.configured ? t("runtime.yes") : t("runtime.no")}`
                    : `${t("runtime.lastConnectedAt")}: ${
                        remoteRuntime?.lastConnectedAt || "n/a"
                      } | ${t("runtime.tlsVerified")}: ${
                        remoteRuntime?.tlsVerified ? t("runtime.yes") : t("runtime.no")
                      }`}
                </p>
              </div>
              <div
                className="deckgo-actions deck-ui-gateway-actions"
                hidden={activeTab !== "runtime"}
              >
                <button
                  className="deckgo-button deck-ui-gateway-button"
                  type="button"
                  onClick={() => {
                    void refreshRuntimeSummary();
                    void refreshDiagnostics();
                  }}
                  disabled={refreshingSummary}
                >
                  {t("runtime.refresh")}
                </button>
              </div>
            </div>

            {gatewayNotConfigured ? (
              <GatewayNotConfiguredEmptyState className="deck-ui-gateway-surface" />
            ) : null}
            <div
              className="deckgo-grid deckgo-grid-2 deck-ui-gateway-surface-grid"
              hidden={activeTab !== "overview" || gatewayNotConfigured}
            >
              <div className="deckgo-surface-tile deck-ui-gateway-surface">
                <p className="deckgo-surface-label">{t("overview.healthDiagnostics")}</p>
                <p className="deckgo-note">
                  {t("overview.ok")}:{" "}
                  {healthResponse?.ok === false
                    ? t("runtime.no")
                    : healthResponse
                      ? t("runtime.yes")
                      : t("runtime.unknown")}{" "}
                  |{t("latency")}:{" "}
                  {typeof healthResponse?.durationMs === "number"
                    ? `${healthResponse.durationMs} ms`
                    : "n/a"}
                </p>
                <p className="deckgo-note">
                  {t("overview.agents")}: {healthResponse?.agents?.length ?? 0} | {t("sessions")}:{" "}
                  {sessionCountFromHealth(healthResponse)} | {t("channels")}: {healthChannelCount}
                </p>
              </div>
              <div className="deckgo-surface-tile deck-ui-gateway-surface">
                <p className="deckgo-surface-label">{t("overview.statusSummary")}</p>
                <p className="deckgo-note">
                  {t("overview.state")}: {statusResponse?.state || t("runtime.unknown")} |{" "}
                  {t("heartbeat")}:{" "}
                  {formatHeartbeatSummary(statusResponse?.heartbeat, {
                    defaultAgent: t("overview.defaultAgent"),
                    enabled: t("overview.enabled"),
                    unknown: t("runtime.unknown"),
                  })}
                </p>
                <p className="deckgo-note">
                  {t("sessions")}: {sessionCountFromStatus(statusResponse?.sessions)} |{" "}
                  {t("channels")}: {statusChannelCount}
                </p>
              </div>
            </div>
            {diagnosticsError && !isGatewayNotConfiguredValue(diagnosticsError) ? (
              <p className="deckgo-note deck-ui-gateway-error">{diagnosticsError}</p>
            ) : null}
            <div
              className="deckgo-surface-tile deck-ui-gateway-surface"
              hidden={activeTab !== "overview" || gatewayNotConfigured}
            >
              <p className="deckgo-surface-label">{t("liveFeed")}</p>
              {activityEvents.length === 0 ? (
                <p className="deckgo-note">{t("noEvents")}</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-gateway-list">
                  {activityEvents.slice(0, 6).map((event) => (
                    <li key={event.id}>
                      <div className="deckgo-selectable-card deck-ui-gateway-row">
                        <strong>{event.description || event.type}</strong>
                        <div className="deckgo-meta">
                          {event.agentName || event.agentId || t("runtime.gateway")} |{" "}
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                        {event.details ? <div className="deckgo-meta">{event.details}</div> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {monitorError && !isGatewayNotConfiguredValue(monitorError) ? (
              <p className="deckgo-note deck-ui-gateway-error">{monitorError}</p>
            ) : null}
          </div>
        </article>
      </div>

      <div
        className="deckgo-column deck-ui-gateway-column"
        hidden={activeTab !== "timeline"}
        id="deck-ui-gateway-timeline"
        role="tabpanel"
      >
        <article className="deckgo-card is-float deck-ui-gateway-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("tabs.timeline")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("timeline.description")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-gateway-body">
            {selectedRun ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-gateway-hero">
                  <div>
                    <p className="deckgo-kicker">{t("timeline.run")}</p>
                    <strong>{selectedRun.runId}</strong>
                    <p className="deckgo-note">
                      {selectedRun.agentId || t("history.unknownAgent")} |{" "}
                      {selectedRun.sessionKey || t("timeline.unknownSession")}
                    </p>
                  </div>
                  <span className="deckgo-pill">{selectedRun.status}</span>
                </div>
                <div className="deckgo-grid deckgo-grid-3 deck-ui-gateway-surface-grid">
                  <div className="deckgo-surface-tile deck-ui-gateway-surface">
                    <p className="deckgo-surface-label">{t("timeline.ganttTitle")}</p>
                    <strong>
                      {monitorRunDetail?.summary?.eventCount ?? selectedRun.eventCount}
                    </strong>
                    <p className="deckgo-note">
                      {t("timeline.duration")}{" "}
                      {formatMonitorDuration(monitorRunDetail?.summary?.durationMs)}
                    </p>
                  </div>
                  <div className="deckgo-surface-tile deck-ui-gateway-surface">
                    <p className="deckgo-surface-label">{t("timeline.toolWaterfallTitle")}</p>
                    <strong>{monitorRunDetail?.summary?.toolCalls ?? selectedRun.toolCalls}</strong>
                    <p className="deckgo-note">
                      {t("timeline.modelCalls")}{" "}
                      {monitorRunDetail?.summary?.modelCalls ?? selectedRun.modelCalls}
                    </p>
                  </div>
                  <div className="deckgo-surface-tile deck-ui-gateway-surface">
                    <p className="deckgo-surface-label">{t("timeline.modelStatsTitle")}</p>
                    <strong>
                      {monitorRunDetail?.summary?.totalTokens ?? selectedRun.totalTokens}
                    </strong>
                    <p className="deckgo-note">{t("timeline.tokens")}</p>
                  </div>
                </div>
                <div className="deckgo-surface-tile deck-ui-gateway-surface">
                  <p className="deckgo-surface-label">{t("timeline.fileChangesTitle")}</p>
                  <p className="deckgo-note">
                    {t("timeline.fileOps")} {monitorRunDetail?.summary?.fileOps ?? 0} |{" "}
                    {t("timeline.subagentSpawns")} {monitorRunDetail?.summary?.subagentSpawns ?? 0}
                  </p>
                </div>
                <div className="deckgo-surface-tile deck-ui-gateway-surface">
                  <p className="deckgo-surface-label">{t("timeline.runEvents")}</p>
                  {(monitorRunDetail?.events ?? []).length === 0 ? (
                    <p className="deckgo-note">{t("noEvents")}</p>
                  ) : (
                    <ul className="deckgo-shell-list deck-ui-gateway-list">
                      {(monitorRunDetail?.events ?? []).slice(0, 12).map((event) => (
                        <li key={event.id}>
                          <div className="deckgo-selectable-card deck-ui-gateway-row">
                            <strong>
                              #{event.seq} {event.stream}
                            </strong>
                            <div className="deckgo-meta">
                              {formatMonitorTimestamp(event.created_at)}
                            </div>
                            <div className="deckgo-meta">{summarizeRunEvent(event)}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="deckgo-surface-tile deck-ui-gateway-surface">
                <p className="deckgo-surface-label">{t("timeline.ganttTitle")}</p>
                <p className="deckgo-note">{t("timeline.selectRun")}</p>
              </div>
            )}
            {monitorError && !isGatewayNotConfiguredValue(monitorError) ? (
              <p className="deckgo-note deck-ui-gateway-error">{monitorError}</p>
            ) : null}
          </div>
        </article>
      </div>

      <div
        className="deckgo-column deck-ui-gateway-column"
        hidden={activeTab !== "history"}
        id="deck-ui-gateway-history"
        role="tabpanel"
      >
        <article className="deckgo-card is-float deck-ui-gateway-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("tabs.history")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("history.description")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-gateway-body">
            <div className="deckgo-surface-tile deck-ui-gateway-surface">
              <p className="deckgo-surface-label">{t("tabs.history")}</p>
              <div className="deckgo-grid deckgo-grid-3 deck-ui-gateway-surface-grid">
                <div className="deckgo-surface-tile deck-ui-gateway-surface">
                  <p className="deckgo-surface-label">{t("stats.totalRuns")}</p>
                  <strong>{monitorStats?.totalRuns ?? monitorRuns.length}</strong>
                </div>
                <div className="deckgo-surface-tile deck-ui-gateway-surface">
                  <p className="deckgo-surface-label">{t("stats.todayRuns")}</p>
                  <strong>{monitorStats?.todayRuns ?? 0}</strong>
                </div>
                <div className="deckgo-surface-tile deck-ui-gateway-surface">
                  <p className="deckgo-surface-label">{t("stats.avgDuration")}</p>
                  <strong>{formatMonitorDuration(monitorStats?.avgDurationMs)}</strong>
                </div>
              </div>
              {monitorRuns.length === 0 ? (
                <p className="deckgo-note">{t("history.noRuns")}</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-gateway-list deck-ui-gateway-spaced">
                  {monitorRuns.map((run) => (
                    <li key={run.runId}>
                      <button
                        className={`deckgo-selectable-card deck-ui-gateway-row ${
                          selectedRunId === run.runId ? "is-selected" : ""
                        }`}
                        type="button"
                        onClick={() => {
                          setActiveTab("timeline");
                          void loadRunDetail(run.runId);
                        }}
                      >
                        <strong>{run.runId}</strong>
                        <div className="deckgo-meta">
                          {run.status} | {t("overview.agent")} {run.agentId || "n/a"} |{" "}
                          {t("sessions")} {run.sessionKey || "n/a"}
                        </div>
                        <div className="deckgo-meta">
                          {t("timeline.events")} {run.eventCount} | {t("timeline.tools")}{" "}
                          {run.toolCalls} | {t("timeline.models")} {run.modelCalls} |{" "}
                          {t("timeline.tokens")} {run.totalTokens}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {monitorError && !isGatewayNotConfiguredValue(monitorError) ? (
              <p className="deckgo-note deck-ui-gateway-error">{monitorError}</p>
            ) : null}
          </div>
        </article>
      </div>

      <aside className="deckgo-column deck-ui-gateway-column" hidden={activeTab !== "runtime"}>
        <article className="deckgo-card deck-ui-gateway-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("runtime.summaryTitle")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("runtime.summaryDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-gateway-body">
            <div className="deckgo-pill-row deck-ui-gateway-status-row">
              <span className="deckgo-pill">
                {t("runtime.mode")} {capabilities?.mode ?? runtimePayload?.mode ?? "unknown"}
              </span>
              <span className="deckgo-pill">
                {t("runtime.configured")}{" "}
                {capabilities?.configured ? t("runtime.yes") : t("runtime.no")}
              </span>
            </div>
            {supervisorState ? (
              <>
                <div className="deckgo-surface-tile deck-ui-gateway-surface">
                  <p className="deckgo-surface-label">{t("runtime.bundledState")}</p>
                  <strong>
                    {t("runtime.pid")}: {bundledRuntime?.pid ?? "n/a"}
                  </strong>
                  <p className="deckgo-note">
                    {t("runtime.ownership")} {runtimeOwnership} | {t("runtime.restartAttempts")}{" "}
                    {restartAttempts}
                  </p>
                </div>
                <div className="deckgo-surface-tile deck-ui-gateway-surface">
                  <p className="deckgo-surface-label">{t("runtime.resolvedUrl")}</p>
                  <strong>{gatewayUrl}</strong>
                  <p className="deckgo-note">
                    {t("runtime.status")} {runtimeStatus} | {t("runtime.health")} {runtimeHealth}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="deckgo-surface-tile deck-ui-gateway-surface">
                  <p className="deckgo-surface-label">{t("runtime.remoteState")}</p>
                  <strong>
                    {t("runtime.lastConnectedAt")}:{" "}
                    {remoteRuntime?.lastConnectedAt || t("runtime.none")}
                  </strong>
                  <p className="deckgo-note">
                    {t("runtime.latencyP50")}:{" "}
                    {remoteRuntime?.latencyP50 != null ? `${remoteRuntime.latencyP50} ms` : "n/a"} |{" "}
                    {t("runtime.tlsVerified")}:{" "}
                    {remoteRuntime?.tlsVerified ? t("runtime.yes") : t("runtime.no")}
                  </p>
                </div>
                <div className="deckgo-surface-tile deck-ui-gateway-surface">
                  <p className="deckgo-surface-label">{t("runtime.lastError")}</p>
                  <strong>{remoteRuntime?.lastError || t("runtime.none")}</strong>
                </div>
              </>
            )}
          </div>
        </article>
      </aside>
    </section>
  );
}
