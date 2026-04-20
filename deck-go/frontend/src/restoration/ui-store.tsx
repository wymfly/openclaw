import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { fetchBootstrapStatus, fetchRuntimeGatewayStatus } from "../api";
import type { DeckGoThemeMode } from "../theme";
import { findRestoredPanel, type RestoredPanelId } from "./panel-registry";
import type { RestorationUIState } from "./types";

const ACTIVE_PANEL_KEY = "deckGoRestorationActivePanel";
const SIDEBAR_COLLAPSED_KEY = "deckGoRestorationSidebarCollapsed";
const SUMMARY_REFRESH_MS = 30_000;

function resolveInitialPanel() {
  if (typeof window === "undefined") {
    return "chat" as RestoredPanelId;
  }

  const urlPanel = new URL(window.location.href).searchParams.get("panel");
  if (urlPanel && findRestoredPanel(urlPanel)) {
    return urlPanel as RestoredPanelId;
  }

  const stored = window.localStorage.getItem(ACTIVE_PANEL_KEY);
  if (stored && findRestoredPanel(stored)) {
    return stored as RestoredPanelId;
  }

  return "chat" as RestoredPanelId;
}

function resolveInitialSidebarCollapsed() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

const RestorationUIContext = createContext<RestorationUIState | null>(null);

export function RestorationUIProvider(
  props: PropsWithChildren<{
    themeMode: DeckGoThemeMode;
    onThemeModeChange: (mode: DeckGoThemeMode) => void;
  }>,
) {
  const [activePanel, setActivePanelState] = useState<RestoredPanelId>(resolveInitialPanel);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(resolveInitialSidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState<RestorationUIState["bootstrap"]>(null);
  const [runtime, setRuntime] = useState<RestorationUIState["runtime"]>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [refreshingSummary, setRefreshingSummary] = useState(false);

  const refreshRuntimeSummary = useEffectEvent(async () => {
    setRefreshingSummary(true);
    try {
      const [bootstrapResult, runtimeResult] = await Promise.all([
        fetchBootstrapStatus(),
        fetchRuntimeGatewayStatus(),
      ]);
      startTransition(() => {
        setBootstrap(bootstrapResult);
        setRuntime(runtimeResult);
        setSummaryError(null);
      });
    } catch (error) {
      startTransition(() => {
        setSummaryError(
          error instanceof Error ? error.message : "failed to refresh restoration runtime summary",
        );
      });
    } finally {
      startTransition(() => {
        setRefreshingSummary(false);
      });
    }
  });

  useEffect(() => {
    void refreshRuntimeSummary();
    const interval = window.setInterval(() => {
      void refreshRuntimeSummary();
    }, SUMMARY_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refreshRuntimeSummary]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(ACTIVE_PANEL_KEY, activePanel);
  }, [activePanel]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("surface") !== "restored-shell") {
      return;
    }
    url.searchParams.set("panel", activePanel);
    url.searchParams.set("nav", sidebarCollapsed ? "collapsed" : "expanded");
    window.history.replaceState({}, "", url);
  }, [activePanel, sidebarCollapsed]);

  const value = useMemo<RestorationUIState>(
    () => ({
      activePanel,
      sidebarCollapsed,
      mobileNavOpen,
      themeMode: props.themeMode,
      bootstrap,
      runtime,
      summaryError,
      refreshingSummary,
      setActivePanel: (panel) => {
        setActivePanelState(panel);
        setMobileNavOpen(false);
      },
      toggleSidebar: () => setSidebarCollapsed((current) => !current),
      setSidebarCollapsed,
      setMobileNavOpen,
      setThemeMode: props.onThemeModeChange,
      refreshRuntimeSummary,
    }),
    [
      activePanel,
      bootstrap,
      mobileNavOpen,
      props.onThemeModeChange,
      props.themeMode,
      refreshingSummary,
      refreshRuntimeSummary,
      runtime,
      sidebarCollapsed,
      summaryError,
    ],
  );

  return (
    <RestorationUIContext.Provider value={value}>{props.children}</RestorationUIContext.Provider>
  );
}

export function useRestorationUI() {
  const context = useContext(RestorationUIContext);
  if (!context) {
    throw new Error("useRestorationUI must be used inside RestorationUIProvider");
  }
  return context;
}
