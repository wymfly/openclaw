import { useTranslations } from "../i18n/provider";
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
  const tNav = useTranslations("nav");
  const tShell = useTranslations("shell");
  const ui = useDeckUI();
  const { activePanel, runtime, bootstrap } = ui;
  const entry = findPanel(activePanel);

  if (!entry) {
    return (
      <section className="deckgo-card">
        <div className="deckgo-card-body">
          <p className="deckgo-note">{tShell("unknownPanel", { panel: activePanel })}</p>
        </div>
      </section>
    );
  }

  const readiness = getPanelReadiness(entry.id);
  const gatewaySummary = bootstrap?.gateway.connected
    ? tShell("gatewayLinked")
    : tShell("gatewayPending");
  const runtimeSummary = runtime?.runtime.status || bootstrap?.runtime.status || tShell("pending");
  const panelComponent = renderPanelComponent(entry.id);

  if (panelComponent) {
    return panelComponent;
  }

  return (
    <section className="deckgo-panel-workspace">
      <article className="deckgo-card is-float">
        <div className="deckgo-card-header">
          <h2 className="deckgo-card-title">{tNav(entry.labelKey)}</h2>
        </div>
        <p className="deckgo-card-subtitle">{tShell("panelHostFallbackDescription")}</p>
        <div className="deckgo-card-body deckgo-dividerless">
          <div className="deckgo-pill-row">
            <span className="deckgo-pill is-primary">
              {tShell("groupLabel")}: {entry.group}
            </span>
            <span className="deckgo-pill">
              {tShell("panelIdLabel")}: {entry.id}
            </span>
            <span className="deckgo-pill is-positive">{readiness.status}</span>
          </div>
          <div className="deckgo-panel-hero-strip">
            <div>
              <p className="deckgo-kicker">{tShell("panelImportTarget")}</p>
              <strong>{entry.importTarget}</strong>
            </div>
            <div className="deckgo-pill-row">
              <span className="deckgo-pill">{gatewaySummary}</span>
              <span className="deckgo-pill">
                {tShell("runtimeLabel")} {runtimeSummary}
              </span>
            </div>
          </div>
          <div className="deckgo-surface-tile">
            {panelPlaceholderDescription(entry, tShell("importLabel"))}
          </div>
        </div>
      </article>

      <aside className="deckgo-column">
        <article className="deckgo-card">
          <div className="deckgo-card-header">
            <h3 className="deckgo-card-title">{tShell("handoffsTitle")}</h3>
          </div>
          <p className="deckgo-card-subtitle">{tShell("handoffsDescription")}</p>
          <div className="deckgo-card-body">
            <div className="deckgo-actions">
              <button className="deckgo-button" type="button" onClick={() => navigateToAgent(ui)}>
                {tNav("agents")}
              </button>
              <button className="deckgo-button" type="button" onClick={() => navigateToSession(ui)}>
                {tNav("sessions")}
              </button>
              <button className="deckgo-button" type="button" onClick={() => navigateToRouting(ui)}>
                {tNav("routing")}
              </button>
              <button className="deckgo-button" type="button" onClick={() => navigateToChannel(ui)}>
                {tNav("channels")}
              </button>
              <button className="deckgo-button" type="button" onClick={() => navigateToPlugin(ui)}>
                {tNav("plugins")}
              </button>
              <button
                className="deckgo-button"
                type="button"
                onClick={() => navigateToSubagents(ui)}
              >
                {tNav("subagents")}
              </button>
            </div>
          </div>
        </article>

        <article className="deckgo-card">
          <div className="deckgo-card-header">
            <h3 className="deckgo-card-title">{tShell("contractReadiness")}</h3>
          </div>
          <p className="deckgo-card-subtitle">{readiness.evidence}</p>
          <div className="deckgo-card-body">
            <div className="deckgo-panel-readiness">
              <span className="deckgo-pill is-positive">{readiness.status}</span>
              {entry.shortcutIndex ? (
                <span className="deckgo-pill">
                  {tShell("altShortcut", { index: entry.shortcutIndex })}
                </span>
              ) : null}
            </div>
          </div>
        </article>
      </aside>
    </section>
  );
}
