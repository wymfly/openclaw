import type { FormEvent } from "react";
import { useThemeMode } from "../theme";
import { DeckPanelHost } from "./PanelHost";
import { DeckShell } from "./Shell";
import { DeckUIProvider, useDeckUI } from "./ui-store";
import { useDeckShortcuts } from "./use-deck-shortcuts";

function DeckAppFrame() {
  const {
    authMessage,
    authRequired,
    authTokenInput,
    refreshingSummary,
    summaryReady,
    setAuthTokenInput,
    unlockControlPlane,
  } = useDeckUI();
  useDeckShortcuts();

  const handleUnlockSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formValue = new FormData(event.currentTarget).get("deckAccessToken");
    const nextToken = typeof formValue === "string" ? formValue : authTokenInput;
    void unlockControlPlane(nextToken);
  };

  if (!summaryReady) {
    return (
      <main className="deck-ui-loading">
        <section className="deck-ui-status-panel">
          <p className="deck-ui-eyebrow">OpenClaw Deck</p>
          <h1>Connecting gateway</h1>
          <p>Resolving the local control plane before opening the operator workspace.</p>
        </section>
      </main>
    );
  }

  if (authRequired) {
    return (
      <main className="deck-ui-loading">
        <section className="deck-ui-status-panel deck-ui-auth-panel">
          <p className="deck-ui-eyebrow">OpenClaw Deck</p>
          <h1>Unlock control plane</h1>
          <p>{authMessage}</p>
          <form className="deckgo-form-grid" onSubmit={handleUnlockSubmit}>
            <label className="deckgo-label">
              <span>Deck access token</span>
              <input
                className="deckgo-input"
                name="deckAccessToken"
                type="password"
                value={authTokenInput}
                onChange={(event) => setAuthTokenInput(event.target.value)}
                placeholder="Enter deck-go access token"
              />
            </label>
            <div className="deckgo-actions">
              <button
                className="deckgo-button is-primary"
                type="submit"
                disabled={refreshingSummary}
              >
                {refreshingSummary ? "Unlocking..." : "Unlock control plane"}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <DeckShell>
      <DeckPanelHost />
    </DeckShell>
  );
}

export function DeckGoApp() {
  const { themeMode, setThemeMode } = useThemeMode();

  return (
    <DeckUIProvider themeMode={themeMode} onThemeModeChange={setThemeMode}>
      <DeckAppFrame />
    </DeckUIProvider>
  );
}
