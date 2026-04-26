import { useCallback, useEffect, useState } from "react";
import type { DeckGoSettingsResponse } from "../../../../../contracts/generated/ts/deck-api.generated";
import {
  fetchGatewayHealth,
  fetchGatewayStatus,
  fetchSettings,
  type DeckGoGatewayHealthResponse,
  type DeckGoGatewayStatusResponse,
  restartRuntimeGateway,
  startRuntimeGateway,
  stopRuntimeGateway,
} from "../../../api";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { JsonDetails } from "../../shared/ShellComponents";

type GatewayActionState = "idle" | "starting" | "stopping" | "restarting";

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

function formatHeartbeatSummary(value: DeckGoGatewayStatusResponse["heartbeat"]) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "unknown";
  }
  const agents = Array.isArray(value.agents) ? value.agents : [];
  const enabled = agents.filter((agent) => agent.enabled !== false).length;
  const defaultAgent = value.defaultAgentId?.trim();
  const cadence = agents.find((agent) => agent.every?.trim())?.every?.trim();
  const parts = [`${enabled}/${agents.length} enabled`];
  if (defaultAgent) {
    parts.push(`default ${defaultAgent}`);
  }
  if (cadence) {
    parts.push(cadence);
  }
  return parts.join(" | ");
}

export function GatewayPanel() {
  const { bootstrap, runtime, refreshingSummary, refreshRuntimeSummary } = useDeckUI();
  const [settingsResponse, setSettingsResponse] = useState<DeckGoSettingsResponse | null>(null);
  const [healthResponse, setHealthResponse] = useState<DeckGoGatewayHealthResponse | null>(null);
  const [statusResponse, setStatusResponse] = useState<DeckGoGatewayStatusResponse | null>(null);
  const [actionState, setActionState] = useState<GatewayActionState>("idle");
  const [error, setError] = useState("");
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const [lastAction, setLastAction] = useState<unknown>(null);

  const refreshSettings = useCallback(async () => {
    try {
      const result = await fetchSettings();
      setSettingsResponse(result);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "failed to load settings");
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  const refreshDiagnostics = useCallback(async () => {
    try {
      const [health, status] = await Promise.all([fetchGatewayHealth(), fetchGatewayStatus()]);
      setHealthResponse(health);
      setStatusResponse(status);
      setDiagnosticsError("");
    } catch (loadError) {
      setDiagnosticsError(
        loadError instanceof Error ? loadError.message : "failed to load gateway diagnostics",
      );
    }
  }, []);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  const runAction = async (nextState: GatewayActionState, action: () => Promise<unknown>) => {
    try {
      setActionState(nextState);
      const result = await action();
      setLastAction(result);
      await refreshRuntimeSummary();
      await refreshSettings();
      await refreshDiagnostics();
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "gateway action failed");
    } finally {
      setActionState("idle");
    }
  };

  const runtimeStatus = runtime?.runtime.status || bootstrap?.runtime.status || "stopped";
  const runtimeHealth = runtime?.runtime.health || bootstrap?.runtime.health || "unknown";
  const gatewayUrl = runtime?.runtime.gatewayUrl || "(not resolved)";
  const managedGateway = settingsResponse?.settings.managedGateway;
  const healthChannelCount = countRecordEntries(healthResponse?.channels);
  const statusChannelCount = countRecordEntries(statusResponse?.channels);
  const runtimeConfigured = runtime?.runtime.configured ?? false;
  const runtimeActionPending = actionState !== "idle";
  const canStart =
    runtimeConfigured &&
    !runtimeActionPending &&
    runtimeStatus !== "running" &&
    runtimeStatus !== "starting";
  const canRestart =
    runtimeConfigured &&
    !runtimeActionPending &&
    runtimeStatus !== "stopped" &&
    runtimeStatus !== "stopping" &&
    runtimeStatus !== "starting";
  const canStop =
    runtimeConfigured &&
    !runtimeActionPending &&
    runtimeStatus !== "stopped" &&
    runtimeStatus !== "stopping";

  return (
    <section className="deckgo-panel-workspace deck-ui-gateway">
      <div className="deckgo-column deck-ui-gateway-column">
        <article className="deckgo-card is-float deck-ui-gateway-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Gateway runtime</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This panel is wired to deck-go&apos;s managed Gateway control plane for runtime status,
            health, diagnostics, and lifecycle actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-gateway-body">
            <div className="deckgo-pill-row deck-ui-gateway-status-row">
              <span
                className={`deckgo-pill ${runtimeStatus === "running" ? "is-positive" : "is-muted"}`}
              >
                status {runtimeStatus}
              </span>
              <span
                className={`deckgo-pill ${runtimeHealth === "healthy" ? "is-positive" : "is-muted"}`}
              >
                health {runtimeHealth}
              </span>
              <span className="deckgo-pill">
                gateway {bootstrap?.gateway.connected ? "linked" : "pending"}
              </span>
              <span className="deckgo-pill">
                refresh {refreshingSummary ? "in-flight" : "idle"}
              </span>
            </div>

            <div className="deckgo-panel-hero-strip deck-ui-gateway-hero">
              <div>
                <p className="deckgo-kicker">Resolved URL</p>
                <strong>{gatewayUrl}</strong>
                <p className="deckgo-note">
                  pid: {runtime?.runtime.pid ?? "n/a"} | configured:{" "}
                  {runtime?.runtime.configured ? "yes" : "no"}
                </p>
              </div>
              <div className="deckgo-actions deck-ui-gateway-actions">
                <button
                  className="deckgo-button deck-ui-gateway-button is-primary"
                  type="button"
                  onClick={() => void runAction("starting", startRuntimeGateway)}
                  disabled={!canStart}
                >
                  Start
                </button>
                <button
                  className="deckgo-button deck-ui-gateway-button"
                  type="button"
                  onClick={() => void runAction("restarting", restartRuntimeGateway)}
                  disabled={!canRestart}
                >
                  Restart
                </button>
                <button
                  className="deckgo-button deck-ui-gateway-button is-danger"
                  type="button"
                  onClick={() => void runAction("stopping", stopRuntimeGateway)}
                  disabled={!canStop}
                >
                  Stop
                </button>
                <button
                  className="deckgo-button deck-ui-gateway-button"
                  type="button"
                  onClick={() => {
                    void refreshRuntimeSummary();
                    void refreshDiagnostics();
                  }}
                  disabled={refreshingSummary}
                >
                  Refresh runtime
                </button>
              </div>
            </div>

            {error ? <p className="deckgo-note deck-ui-gateway-error">{error}</p> : null}
            {lastAction ? <JsonDetails title="Last runtime action" payload={lastAction} /> : null}
            <div className="deckgo-grid deckgo-grid-2 deck-ui-gateway-surface-grid">
              <div className="deckgo-surface-tile deck-ui-gateway-surface">
                <p className="deckgo-surface-label">Gateway health diagnostics</p>
                <p className="deckgo-note">
                  ok: {healthResponse?.ok === false ? "no" : healthResponse ? "yes" : "unknown"} |
                  latency:{" "}
                  {typeof healthResponse?.durationMs === "number"
                    ? `${healthResponse.durationMs} ms`
                    : "n/a"}
                </p>
                <p className="deckgo-note">
                  agents: {healthResponse?.agents?.length ?? 0} | sessions:{" "}
                  {sessionCountFromHealth(healthResponse)} | channels: {healthChannelCount}
                </p>
              </div>
              <div className="deckgo-surface-tile deck-ui-gateway-surface">
                <p className="deckgo-surface-label">Gateway status summary</p>
                <p className="deckgo-note">
                  state: {statusResponse?.state || "unknown"} | heartbeat:{" "}
                  {formatHeartbeatSummary(statusResponse?.heartbeat)}
                </p>
                <p className="deckgo-note">
                  sessions: {sessionCountFromStatus(statusResponse?.sessions)} | channels:{" "}
                  {statusChannelCount}
                </p>
              </div>
            </div>
            {diagnosticsError ? (
              <p className="deckgo-note deck-ui-gateway-error">{diagnosticsError}</p>
            ) : null}
          </div>
        </article>
      </div>

      <aside className="deckgo-column deck-ui-gateway-column">
        <article className="deckgo-card deck-ui-gateway-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Managed gateway settings</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Settings are still deck-go owned, but they are now visible from the Gateway panel
            instead of being trapped inside the old workbench.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-gateway-body">
            <div className="deckgo-pill-row deck-ui-gateway-status-row">
              <span className="deckgo-pill">mode {managedGateway?.mode || "managed"}</span>
              <span className="deckgo-pill">
                autoStart {managedGateway?.autoStart ? "on" : "off"}
              </span>
            </div>
            <div className="deckgo-surface-tile deck-ui-gateway-surface">
              <p className="deckgo-surface-label">Command</p>
              <strong>{managedGateway?.command || "(unset)"}</strong>
              <p className="deckgo-note">
                args: {(managedGateway?.args ?? []).join(" ") || "(none)"}
              </p>
            </div>
            <div className="deckgo-surface-tile deck-ui-gateway-surface">
              <p className="deckgo-surface-label">Working directory</p>
              <strong>{managedGateway?.workingDir || "(unset)"}</strong>
              <p className="deckgo-note">
                bind: {managedGateway?.bindHost || "127.0.0.1"}:{managedGateway?.bindPort ?? 0}
              </p>
            </div>
          </div>
        </article>

        {settingsResponse ? (
          <article className="deckgo-card deck-ui-gateway-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Raw settings seam</h2>
            </div>
            <div className="deckgo-card-body deck-ui-gateway-body">
              <JsonDetails title="Settings response" payload={settingsResponse} />
            </div>
          </article>
        ) : null}

        {healthResponse || statusResponse ? (
          <article className="deckgo-card deck-ui-gateway-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Raw gateway diagnostics</h2>
            </div>
            <div className="deckgo-card-body deck-ui-gateway-body">
              <JsonDetails
                title="Gateway diagnostics"
                payload={{ health: healthResponse, status: statusResponse }}
              />
            </div>
          </article>
        ) : null}
      </aside>
    </section>
  );
}
