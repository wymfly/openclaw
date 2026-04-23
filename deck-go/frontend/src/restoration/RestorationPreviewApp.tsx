import { useRef } from "react";
import { useThemeMode } from "../theme";
import { ActivePanelHost } from "./ActivePanelHost";
import { RestoredShell } from "./layout/Shell";
import { useRestorationUI, RestorationUIProvider } from "./ui-store";
import { useRestorationShortcuts } from "./use-restoration-shortcuts";

function RestorationPreviewFrame() {
  const {
    authMessage,
    authRequired,
    authTokenInput,
    refreshingSummary,
    summaryReady,
    setAuthTokenInput,
    unlockControlPlane,
  } = useRestorationUI();
  const authInputRef = useRef<HTMLInputElement | null>(null);
  useRestorationShortcuts();

  if (!summaryReady) {
    return (
      <main className="deckgo-shell">
        <section className="deckgo-status-band">
          <div className="deckgo-status-copy">
            <p className="deckgo-kicker">Stage 3 active host</p>
            <h1 className="deckgo-title">Connecting control plane</h1>
            <p className="deckgo-subtitle">
              The restored shell is resolving runtime/bootstrap summary before it mounts the active
              panel workspace.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (authRequired) {
    return (
      <main className="deckgo-shell">
        <section className="deckgo-status-band">
          <div className="deckgo-status-copy">
            <p className="deckgo-kicker">Stage 3 active host</p>
            <h1 className="deckgo-title">Unlock control plane</h1>
            <p className="deckgo-subtitle">
              The restored shell is active, but deck-go control-plane reads still require the
              configured access token. Enter it once to restore the live operator path.
            </p>
          </div>
        </section>

        <section className="deckgo-grid">
          <div className="deckgo-column" />
          <section className="deckgo-column">
            <section className="deckgo-card is-float">
              <div className="deckgo-card-header">
                <h2 className="deckgo-card-title">Authentication required</h2>
              </div>
              <p className="deckgo-card-subtitle">{authMessage}</p>
              <div className="deckgo-card-body deckgo-form-grid">
                <label className="deckgo-label">
                  <span>Deck access token</span>
                  <input
                    ref={authInputRef}
                    className="deckgo-input"
                    type="password"
                    value={authTokenInput}
                    onChange={(event) => setAuthTokenInput(event.target.value)}
                    placeholder="Enter deck-go access token"
                  />
                </label>
                <div className="deckgo-actions">
                  <button
                    className="deckgo-button is-primary"
                    type="button"
                    onClick={() =>
                      void unlockControlPlane(authInputRef.current?.value ?? authTokenInput)
                    }
                    disabled={refreshingSummary}
                  >
                    {refreshingSummary ? "Unlocking..." : "Unlock control plane"}
                  </button>
                </div>
              </div>
            </section>
          </section>
          <div className="deckgo-column" />
        </section>
      </main>
    );
  }

  return (
    <RestoredShell>
      <section className="deckgo-status-band">
        <div className="deckgo-status-copy">
          <p className="deckgo-kicker">Stage 3 active host</p>
          <h1 className="deckgo-title">Deck Go operator shell</h1>
          <p className="deckgo-subtitle">
            The default frontend surface now runs directly through the restored shell, nav rail, and
            panel registry runtime. This is the active Vite host path for Stage 3 migration.
          </p>
        </div>
      </section>
      <ActivePanelHost />
    </RestoredShell>
  );
}

export function RestorationPreviewApp() {
  const { themeMode, setThemeMode } = useThemeMode();

  return (
    <RestorationUIProvider themeMode={themeMode} onThemeModeChange={setThemeMode}>
      <RestorationPreviewFrame />
    </RestorationUIProvider>
  );
}
