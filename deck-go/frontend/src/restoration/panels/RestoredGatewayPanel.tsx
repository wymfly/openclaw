import { useEffect, useEffectEvent, useState } from "react";
import type { DeckGoSettingsResponse } from "../../../../contracts/generated/ts/deck-api.generated";
import {
  fetchSettings,
  restartRuntimeGateway,
  startRuntimeGateway,
  stopRuntimeGateway,
} from "../../api";
import { JsonDetails } from "../../shell-components";
import { useRestorationUI } from "../ui-store";

type GatewayActionState = "idle" | "starting" | "stopping" | "restarting";

export function RestoredGatewayPanel() {
  const { bootstrap, runtime, refreshingSummary, refreshRuntimeSummary } = useRestorationUI();
  const [settingsResponse, setSettingsResponse] = useState<DeckGoSettingsResponse | null>(null);
  const [actionState, setActionState] = useState<GatewayActionState>("idle");
  const [error, setError] = useState("");
  const [lastAction, setLastAction] = useState<unknown>(null);

  const refreshSettings = useEffectEvent(async () => {
    try {
      const result = await fetchSettings();
      setSettingsResponse(result);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "failed to load settings");
    }
  });

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  const runAction = async (nextState: GatewayActionState, action: () => Promise<unknown>) => {
    try {
      setActionState(nextState);
      const result = await action();
      setLastAction(result);
      await refreshRuntimeSummary();
      await refreshSettings();
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

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Gateway runtime</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This restored panel is wired to deck-go&apos;s managed Gateway control plane, not the
            legacy workbench shell.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
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

            <div className="deckgo-restored-hero-strip">
              <div>
                <p className="deckgo-kicker">Resolved URL</p>
                <strong>{gatewayUrl}</strong>
                <p className="deckgo-note">
                  pid: {runtime?.runtime.pid ?? "n/a"} | configured:{" "}
                  {runtime?.runtime.configured ? "yes" : "no"}
                </p>
              </div>
              <div className="deckgo-actions">
                <button
                  className="deckgo-button is-primary"
                  type="button"
                  onClick={() => void runAction("starting", startRuntimeGateway)}
                  disabled={actionState !== "idle"}
                >
                  Start
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void runAction("restarting", restartRuntimeGateway)}
                  disabled={actionState !== "idle"}
                >
                  Restart
                </button>
                <button
                  className="deckgo-button is-danger"
                  type="button"
                  onClick={() => void runAction("stopping", stopRuntimeGateway)}
                  disabled={actionState !== "idle"}
                >
                  Stop
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refreshRuntimeSummary()}
                  disabled={refreshingSummary}
                >
                  Refresh runtime
                </button>
              </div>
            </div>

            {error ? (
              <p className="deckgo-note" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            ) : null}
            {lastAction ? <JsonDetails title="Last runtime action" payload={lastAction} /> : null}
          </div>
        </article>
      </div>

      <aside className="deckgo-column">
        <article className="deckgo-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Managed gateway settings</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Settings are still deck-go owned, but they are now visible from the restored Gateway
            panel instead of being trapped inside the old workbench.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className="deckgo-pill">mode {managedGateway?.mode || "managed"}</span>
              <span className="deckgo-pill">
                autoStart {managedGateway?.autoStart ? "on" : "off"}
              </span>
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Command</p>
              <strong>{managedGateway?.command || "(unset)"}</strong>
              <p className="deckgo-note">
                args: {(managedGateway?.args ?? []).join(" ") || "(none)"}
              </p>
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Working directory</p>
              <strong>{managedGateway?.workingDir || "(unset)"}</strong>
              <p className="deckgo-note">
                bind: {managedGateway?.bindHost || "127.0.0.1"}:{managedGateway?.bindPort ?? 0}
              </p>
            </div>
          </div>
        </article>

        {settingsResponse ? (
          <article className="deckgo-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Raw settings seam</h2>
            </div>
            <div className="deckgo-card-body">
              <JsonDetails title="Settings response" payload={settingsResponse} />
            </div>
          </article>
        ) : null}
      </aside>
    </section>
  );
}
