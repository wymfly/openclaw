import { renderPanelComponent } from "./panel-component-registry";
import {
  navigateToAgent,
  navigateToChannel,
  navigateToPlugin,
  navigateToRouting,
  navigateToSession,
  navigateToSubagents,
} from "./panel-navigation";
import { getPanelReadiness } from "./panel-readiness";
import { findPanel, panelPlaceholderDescription } from "./panel-registry";
import { useDeckUI } from "./ui-store";

export function ActivePanelHost() {
  const ui = useDeckUI();
  const { activePanel, runtime, bootstrap } = ui;
  const entry = findPanel(activePanel);

  if (!entry) {
    return (
      <section className="deckgo-card">
        <div className="deckgo-card-body">
          <p className="deckgo-note">Unknown panel: {activePanel}</p>
        </div>
      </section>
    );
  }

  const readiness = getPanelReadiness(entry.id);
  const gatewaySummary = bootstrap?.gateway.connected ? "Gateway linked" : "Gateway pending";
  const runtimeSummary = runtime?.runtime.status || bootstrap?.runtime.status || "pending";
  const panelComponent = renderPanelComponent(entry.id);

  if (panelComponent) {
    return panelComponent;
  }

  return (
    <section className="deckgo-panel-workspace">
      <article className="deckgo-card is-float">
        <div className="deckgo-card-header">
          <h2 className="deckgo-card-title">{entry.label}</h2>
        </div>
        <p className="deckgo-card-subtitle">
          Deck panel host keyed to the active panel registry. This fallback appears only when a
          panel id has no registered component.
        </p>
        <div className="deckgo-card-body deckgo-dividerless">
          <div className="deckgo-pill-row">
            <span className="deckgo-pill is-primary">group: {entry.group}</span>
            <span className="deckgo-pill">panel id: {entry.id}</span>
            <span className="deckgo-pill is-positive">{readiness.status}</span>
          </div>
          <div className="deckgo-panel-hero-strip">
            <div>
              <p className="deckgo-kicker">Panel import target</p>
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
            Jump between related operational surfaces without losing the active runtime context.
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
            <div className="deckgo-panel-readiness">
              <span className="deckgo-pill is-positive">{readiness.status}</span>
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
