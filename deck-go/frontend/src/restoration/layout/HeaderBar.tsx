import { RESTORED_PANELS, findRestoredPanel, getRestoredPanelIndex } from "../panel-registry";
import { useRestorationUI } from "../ui-store";
import { useRestorationViewport } from "../use-restoration-viewport";

export function RestoredHeaderBar() {
  const {
    activePanel,
    bootstrap,
    runtime,
    sidebarCollapsed,
    summaryError,
    themeMode,
    setThemeMode,
    setActivePanel,
    toggleSidebar,
    setMobileNavOpen,
    refreshRuntimeSummary,
    refreshingSummary,
  } = useRestorationUI();
  const { isMobile } = useRestorationViewport();
  const entry = findRestoredPanel(activePanel);
  const panelIndex = getRestoredPanelIndex(activePanel);
  const runtimeStatus = runtime?.runtime.status || bootstrap?.runtime.status || "pending";
  const gatewayConnected = bootstrap?.gateway.connected ?? false;

  return (
    <header className="deckgo-restored-header">
      <div className="deckgo-restored-header-left">
        <button
          className="deckgo-button"
          type="button"
          onClick={() => (isMobile ? setMobileNavOpen(true) : toggleSidebar())}
        >
          {isMobile ? "Menu" : sidebarCollapsed ? "Expand" : "Collapse"}
        </button>
        <div>
          <p className="deckgo-kicker">Legacy shell truth</p>
          <h2 className="deckgo-card-title">{entry?.label ?? activePanel}</h2>
          <p className="deckgo-restored-header-meta">
            {entry?.group ?? "unknown"} · panel {panelIndex + 1} / {RESTORED_PANELS.length}
          </p>
        </div>
      </div>
      <div className="deckgo-restored-header-right">
        <button
          type="button"
          className={`deckgo-pill ${gatewayConnected ? "is-positive" : "is-muted"}`}
          onClick={() => setActivePanel("gateway")}
        >
          Gateway {gatewayConnected ? "linked" : "pending"}
        </button>
        <span className="deckgo-pill">Runtime {runtimeStatus}</span>
        <button
          type="button"
          className="deckgo-button"
          onClick={() => void refreshRuntimeSummary()}
          disabled={refreshingSummary}
        >
          {refreshingSummary ? "Refreshing" : "Refresh"}
        </button>
        <div className="deckgo-theme-toggle" aria-label="Restored theme switch">
          <button
            type="button"
            className={themeMode === "dark" ? "is-active" : ""}
            onClick={() => setThemeMode("dark")}
          >
            Dark
          </button>
          <button
            type="button"
            className={themeMode === "light" ? "is-active" : ""}
            onClick={() => setThemeMode("light")}
          >
            Light
          </button>
        </div>
      </div>
      {summaryError ? <div className="deckgo-restored-header-alert">{summaryError}</div> : null}
    </header>
  );
}
