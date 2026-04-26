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
import { readStoredDeckAccessToken, writeStoredDeckAccessToken } from "../lib/deck-auth-storage";
import type { DeckGoThemeMode } from "../theme";
import { findPanel, type PanelId } from "./panel-registry";
import type { DeckUIState } from "./types";

const ACTIVE_PANEL_KEY = "deckGoActivePanel";
const LEGACY_ACTIVE_PANEL_KEY = "deckGoRestorationActivePanel";
const SIDEBAR_COLLAPSED_KEY = "deckGoSidebarCollapsed";
const LEGACY_SIDEBAR_COLLAPSED_KEY = "deckGoRestorationSidebarCollapsed";
const SUMMARY_REFRESH_MS = 30_000;
const DEFAULT_AUTH_MESSAGE = "Enter the deck-go access token to unlock the control plane.";

function isAuthError(message: string) {
  return /authentication token/i.test(message) || /unauthorized/i.test(message);
}

function resolveInitialPanel() {
  if (typeof window === "undefined") {
    return "chat" as PanelId;
  }

  const urlPanel = new URL(window.location.href).searchParams.get("panel");
  if (urlPanel && findPanel(urlPanel)) {
    return urlPanel as PanelId;
  }

  const stored =
    window.localStorage.getItem(ACTIVE_PANEL_KEY) ??
    window.localStorage.getItem(LEGACY_ACTIVE_PANEL_KEY);
  if (stored && findPanel(stored)) {
    return stored as PanelId;
  }

  return "chat" as PanelId;
}

function resolveInitialSidebarCollapsed() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) ??
      window.localStorage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY)) === "true"
  );
}

function persistRuntimePreference(key: string, legacyKey: string, value: string) {
  window.localStorage.setItem(key, value);
  window.localStorage.removeItem(legacyKey);
}

const DeckUIContext = createContext<DeckUIState | null>(null);

export function DeckUIProvider(
  props: PropsWithChildren<{
    themeMode: DeckGoThemeMode;
    onThemeModeChange: (mode: DeckGoThemeMode) => void;
  }>,
) {
  const [activePanel, setActivePanelState] = useState<PanelId>(resolveInitialPanel);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(resolveInitialSidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authMessage, setAuthMessage] = useState(DEFAULT_AUTH_MESSAGE);
  const [authTokenInput, setAuthTokenInput] = useState(() => readStoredDeckAccessToken() ?? "");
  const [summaryReady, setSummaryReady] = useState(false);
  const [bootstrap, setBootstrap] = useState<DeckUIState["bootstrap"]>(null);
  const [runtime, setRuntime] = useState<DeckUIState["runtime"]>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [refreshingSummary, setRefreshingSummary] = useState(false);

  const loadRuntimeSummary = useEffectEvent(async () => {
    const [bootstrapResult, runtimeResult] = await Promise.all([
      fetchBootstrapStatus(),
      fetchRuntimeGatewayStatus(),
    ]);
    return { bootstrapResult, runtimeResult };
  });

  const applyRuntimeSummary = useEffectEvent(
    (
      bootstrapResult: NonNullable<DeckUIState["bootstrap"]>,
      runtimeResult: NonNullable<DeckUIState["runtime"]>,
    ) => {
      startTransition(() => {
        setBootstrap(bootstrapResult);
        setRuntime(runtimeResult);
        setSummaryError(null);
        setAuthRequired(false);
        setAuthMessage(DEFAULT_AUTH_MESSAGE);
        setSummaryReady(true);
      });
    },
  );

  const refreshRuntimeSummary = useEffectEvent(async () => {
    setRefreshingSummary(true);
    try {
      const { bootstrapResult, runtimeResult } = await loadRuntimeSummary();
      applyRuntimeSummary(bootstrapResult, runtimeResult);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "failed to refresh deck runtime summary";
      startTransition(() => {
        setBootstrap(null);
        setRuntime(null);
        if (isAuthError(message)) {
          setAuthRequired(true);
          setAuthMessage(message);
          setSummaryError(null);
          setSummaryReady(true);
        } else {
          setSummaryError(message);
          setSummaryReady(true);
        }
      });
    } finally {
      startTransition(() => {
        setRefreshingSummary(false);
      });
    }
  });

  const unlockControlPlane = useEffectEvent(async (nextToken?: string) => {
    const token = (nextToken ?? authTokenInput).trim();
    if (!token) {
      startTransition(() => {
        setAuthRequired(true);
        setAuthMessage("Access token is required.");
      });
      return;
    }

    writeStoredDeckAccessToken(token);
    startTransition(() => {
      setAuthTokenInput(token);
    });
    setRefreshingSummary(true);
    try {
      const { bootstrapResult, runtimeResult } = await loadRuntimeSummary();
      applyRuntimeSummary(bootstrapResult, runtimeResult);
    } catch (error) {
      writeStoredDeckAccessToken(null);
      const message = error instanceof Error ? error.message : "failed to unlock the control plane";
      startTransition(() => {
        setBootstrap(null);
        setRuntime(null);
        setAuthRequired(true);
        setAuthMessage(message);
        setSummaryError(null);
        setSummaryReady(true);
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
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    persistRuntimePreference(ACTIVE_PANEL_KEY, LEGACY_ACTIVE_PANEL_KEY, activePanel);
  }, [activePanel]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    persistRuntimePreference(
      SIDEBAR_COLLAPSED_KEY,
      LEGACY_SIDEBAR_COLLAPSED_KEY,
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("surface") !== "deck-ui") {
      return;
    }
    url.searchParams.set("panel", activePanel);
    url.searchParams.set("nav", sidebarCollapsed ? "collapsed" : "expanded");
    window.history.replaceState({}, "", url);
  }, [activePanel, sidebarCollapsed]);

  const value = useMemo<DeckUIState>(
    () => ({
      activePanel,
      sidebarCollapsed,
      mobileNavOpen,
      themeMode: props.themeMode,
      authRequired,
      authMessage,
      authTokenInput,
      summaryReady,
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
      setAuthTokenInput,
      unlockControlPlane,
      refreshRuntimeSummary,
    }),
    [
      activePanel,
      authMessage,
      authRequired,
      authTokenInput,
      bootstrap,
      mobileNavOpen,
      props.onThemeModeChange,
      props.themeMode,
      refreshingSummary,
      refreshRuntimeSummary,
      runtime,
      sidebarCollapsed,
      summaryReady,
      summaryError,
      unlockControlPlane,
    ],
  );

  return <DeckUIContext.Provider value={value}>{props.children}</DeckUIContext.Provider>;
}

export function useDeckUI() {
  const context = useContext(DeckUIContext);
  if (!context) {
    throw new Error("useDeckUI must be used inside DeckUIProvider");
  }
  return context;
}
