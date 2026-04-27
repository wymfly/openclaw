import type { FormEvent } from "react";
import { ToastContainer } from "../components/shared/ToastContainer";
import { useTranslations } from "../i18n/provider";
import { useThemeMode } from "../theme";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { PanelErrorBoundary } from "./PanelErrorBoundary";
import { DeckPanelHost } from "./PanelHost";
import { DeckShell } from "./Shell";
import { DeckUIProvider, useDeckUI } from "./ui-store";
import { useDeckShortcuts } from "./use-deck-shortcuts";

const DEFAULT_AUTH_MESSAGE = "Enter the deck-go access token to unlock the control plane.";
const TOKEN_REQUIRED_MESSAGE = "Access token is required.";

function resolveAuthMessage(message: string, tShell: (key: string) => string) {
  if (!message || message === DEFAULT_AUTH_MESSAGE) {
    return tShell("authDescription");
  }
  if (message === TOKEN_REQUIRED_MESSAGE) {
    return tShell("authTokenRequired");
  }
  return message;
}

function DeckAppFrame() {
  const tShell = useTranslations("shell");
  const tPanelError = useTranslations("panelError");
  const {
    activePanel,
    authMessage,
    authRequired,
    authTokenInput,
    refreshingSummary,
    summaryReady,
    setAuthTokenInput,
    unlockControlPlane,
  } = useDeckUI();
  const { shortcutsOpen, setShortcutsOpen } = useDeckShortcuts();

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
          <h1>{tShell("loadingTitle")}</h1>
          <p>{tShell("loadingDescription")}</p>
        </section>
      </main>
    );
  }

  if (authRequired) {
    return (
      <main className="deck-ui-loading">
        <section className="deck-ui-status-panel deck-ui-auth-panel">
          <p className="deck-ui-eyebrow">OpenClaw Deck</p>
          <h1>{tShell("authTitle")}</h1>
          <p>{resolveAuthMessage(authMessage, tShell)}</p>
          <form className="deckgo-form-grid" onSubmit={handleUnlockSubmit}>
            <label className="deckgo-label">
              <span>{tShell("authTokenLabel")}</span>
              <input
                className="deckgo-input"
                name="deckAccessToken"
                type="password"
                value={authTokenInput}
                onChange={(event) => setAuthTokenInput(event.target.value)}
                placeholder={tShell("authTokenPlaceholder")}
              />
            </label>
            <div className="deckgo-actions">
              <button
                className="deckgo-button is-primary"
                type="submit"
                disabled={refreshingSummary}
              >
                {refreshingSummary ? tShell("unlocking") : tShell("unlock")}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <DeckShell>
        <PanelErrorBoundary
          resetKey={activePanel}
          labels={{
            description: tPanelError("description"),
            details: tPanelError("details"),
            retry: tPanelError("retry"),
            title: tPanelError("title"),
          }}
        >
          <DeckPanelHost />
        </PanelErrorBoundary>
      </DeckShell>
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ToastContainer />
    </>
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
