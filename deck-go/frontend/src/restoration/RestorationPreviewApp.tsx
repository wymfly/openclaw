import { useThemeMode } from "../theme";
import { ActivePanelHost } from "./ActivePanelHost";
import { RestoredShell } from "./layout/Shell";
import { RestorationUIProvider } from "./ui-store";
import { useRestorationShortcuts } from "./use-restoration-shortcuts";

function RestorationPreviewFrame() {
  useRestorationShortcuts();

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
