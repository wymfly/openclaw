import type { ReactNode } from "react";
import { useLocale, useSetLocale, useTranslations } from "../i18n/provider";
import { DECK_GO_THEME_TOGGLE_ORDER, type DeckGoThemeMode } from "../theme";
import { GlobeIcon, MenuIcon, MonitorIcon, MoonIcon, SunIcon } from "./icons";
import { findPanel } from "./panel-registry";
import { useDeckUI } from "./ui-store";
import { useDeckViewport } from "./use-deck-viewport";

export function DeckHeaderBar() {
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const locale = useLocale();
  const setLocale = useSetLocale();
  const {
    activePanel,
    bootstrap,
    summaryError,
    themeMode,
    setThemeMode,
    setActivePanel,
    setMobileNavOpen,
  } = useDeckUI();
  const { isMobile } = useDeckViewport();
  const entry = findPanel(activePanel);
  const gatewayConnected = bootstrap?.gateway.connected ?? false;
  const panelLabel = entry ? tNav(entry.labelKey) : activePanel;
  const toggleLocale = () => setLocale(locale === "zh" ? "en" : "zh");
  const themeLabels: Record<DeckGoThemeMode, string> = {
    dark: tHeader("themeDark"),
    light: tHeader("themeLight"),
    system: tHeader("themeSystem"),
  };
  const themeIcons: Record<DeckGoThemeMode, ReactNode> = {
    dark: <MoonIcon />,
    light: <SunIcon />,
    system: <MonitorIcon />,
  };
  const toggleTheme = () => {
    const currentIndex = DECK_GO_THEME_TOGGLE_ORDER.indexOf(themeMode);
    setThemeMode(
      DECK_GO_THEME_TOGGLE_ORDER[(currentIndex + 1) % DECK_GO_THEME_TOGGLE_ORDER.length],
    );
  };

  return (
    <header className="deck-ui-header">
      <div className="deck-ui-header-left">
        {isMobile ? (
          <button
            className="deck-ui-icon-button"
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label={tHeader("openNavigation")}
          >
            <MenuIcon />
          </button>
        ) : null}
        <div>
          <h1>{panelLabel}</h1>
        </div>
      </div>

      <div className="deck-ui-header-right">
        <button
          type="button"
          className={`deck-ui-status-chip ${gatewayConnected ? "is-healthy" : "is-muted"}`}
          onClick={() => setActivePanel("gateway")}
        >
          <span className="deck-ui-dot" aria-hidden="true" />
          {gatewayConnected ? tHeader("connected") : tHeader("disconnected")}
        </button>
        <button
          type="button"
          className="deck-ui-quiet-button"
          onClick={toggleLocale}
          aria-label={tHeader("switchLocale")}
        >
          <GlobeIcon />
          <span>{locale === "zh" ? "EN" : "ZH"}</span>
        </button>
        <button
          type="button"
          className="deck-ui-quiet-button"
          onClick={toggleTheme}
          aria-label={`${tHeader("themeSwitch")}: ${themeLabels[themeMode]}`}
        >
          {themeIcons[themeMode]}
        </button>
      </div>
      {summaryError ? <p className="deck-ui-header-alert">{summaryError}</p> : null}
    </header>
  );
}
