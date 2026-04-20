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
          <p className="deckgo-kicker">Tranche 1 shell runtime</p>
          <h1 className="deckgo-title">Legacy shell restoration</h1>
          <p className="deckgo-subtitle">
            The default frontend surface now anchors to the legacy shell, nav rail, and panel
            registry runtime. The previous monolithic workbench remains available only as an
            explicit fallback surface.
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
