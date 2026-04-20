import { getRestorationReadiness } from "./contract-readiness";
import {
  navigateToAgent,
  navigateToChannel,
  navigateToPlugin,
  navigateToRouting,
  navigateToSession,
  navigateToSubagents,
} from "./panel-navigation";
import { findRestoredPanel, panelPlaceholderDescription } from "./panel-registry";
import { RestoredChatPanel } from "./panels/RestoredChatPanel";
import { RestoredGatewayPanel } from "./panels/RestoredGatewayPanel";
import { RestoredLogsPanel } from "./panels/RestoredLogsPanel";
import { RestoredSessionsPanel } from "./panels/RestoredSessionsPanel";
import { RestoredSettingsPanel } from "./panels/RestoredSettingsPanel";
import { useRestorationUI } from "./ui-store";

export function ActivePanelHost() {
  const ui = useRestorationUI();
  const { activePanel, runtime, bootstrap } = ui;
  const entry = findRestoredPanel(activePanel);

  if (!entry) {
    return (
      <section className="deckgo-card">
        <div className="deckgo-card-body">
          <p className="deckgo-note">Unknown panel: {activePanel}</p>
        </div>
      </section>
    );
  }

  const readiness = getRestorationReadiness(entry.id);
  const gatewaySummary = bootstrap?.gateway.connected ? "Gateway linked" : "Gateway pending";
  const runtimeSummary = runtime?.runtime.status || bootstrap?.runtime.status || "pending";

  if (entry.id === "chat") {
    return <RestoredChatPanel />;
  }

  if (entry.id === "gateway") {
    return <RestoredGatewayPanel />;
  }

  if (entry.id === "logs") {
    return <RestoredLogsPanel />;
  }

  if (entry.id === "sessions") {
    return <RestoredSessionsPanel />;
  }

  if (entry.id === "settings") {
    return <RestoredSettingsPanel />;
  }

  return (
    <section className="deckgo-restored-workspace">
      <article className="deckgo-card is-float">
        <div className="deckgo-card-header">
          <h2 className="deckgo-card-title">{entry.label}</h2>
        </div>
        <p className="deckgo-card-subtitle">
          Restored panel host keyed to the legacy panel registry. The preview keeps shell, nav rail,
          and panel runtime separate from the current monolithic workbench surface.
        </p>
        <div className="deckgo-card-body deckgo-dividerless">
          <div className="deckgo-pill-row">
            <span className="deckgo-pill is-primary">group: {entry.group}</span>
            <span className="deckgo-pill">panel id: {entry.id}</span>
            <span
              className={`deckgo-pill ${readiness.status === "frontend-blocked" ? "is-danger" : "is-muted"}`}
            >
              {readiness.status}
            </span>
          </div>
          <div className="deckgo-restored-hero-strip">
            <div>
              <p className="deckgo-kicker">Legacy import target</p>
              <strong>{entry.importTarget}</strong>
            </div>
            <div className="deckgo-pill-row">
              <span className="deckgo-pill">{gatewaySummary}</span>
              <span className="deckgo-pill">Runtime {runtimeSummary}</span>
            </div>
          </div>
          <div className="deckgo-surface-tile">{panelPlaceholderDescription(entry)}</div>
        </div>
      </article>

      <aside className="deckgo-column">
        <article className="deckgo-card">
          <div className="deckgo-card-header">
            <h3 className="deckgo-card-title">Cross-panel handoffs</h3>
          </div>
          <p className="deckgo-card-subtitle">
            Preview the restored `panel-navigation` seam instead of letting one screen own the whole
            topology.
          </p>
          <div className="deckgo-card-body">
            <div className="deckgo-actions">
              <button className="deckgo-button" type="button" onClick={() => navigateToAgent(ui)}>
                Agents
              </button>
              <button className="deckgo-button" type="button" onClick={() => navigateToSession(ui)}>
                Sessions
              </button>
              <button className="deckgo-button" type="button" onClick={() => navigateToRouting(ui)}>
                Routing
              </button>
              <button className="deckgo-button" type="button" onClick={() => navigateToChannel(ui)}>
                Channels
              </button>
              <button className="deckgo-button" type="button" onClick={() => navigateToPlugin(ui)}>
                Plugins
              </button>
              <button
                className="deckgo-button"
                type="button"
                onClick={() => navigateToSubagents(ui)}
              >
                Subagents
              </button>
            </div>
          </div>
        </article>

        <article className="deckgo-card">
          <div className="deckgo-card-header">
            <h3 className="deckgo-card-title">Contract readiness</h3>
          </div>
          <p className="deckgo-card-subtitle">{readiness.evidence}</p>
          <div className="deckgo-card-body">
            <div className="deckgo-restored-readiness">
              <span
                className={`deckgo-pill ${readiness.status === "frontend-blocked" ? "is-danger" : "is-muted"}`}
              >
                {readiness.status}
              </span>
              {entry.shortcutIndex ? (
                <span className="deckgo-pill">Alt+{entry.shortcutIndex} shortcut</span>
              ) : null}
            </div>
          </div>
        </article>
      </aside>
    </section>
  );
}
