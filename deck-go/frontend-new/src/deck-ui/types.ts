import type { DeckGoBootstrapStatusResponse, DeckGoRuntimeGatewayResponse } from "../api";
import type { DeckGoThemeMode } from "../theme";
import type { PanelId } from "./panel-registry";

export type DeckUIState = {
  activePanel: PanelId;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  themeMode: DeckGoThemeMode;
  authRequired: boolean;
  authMessage: string;
  authTokenInput: string;
  summaryReady: boolean;
  bootstrap: DeckGoBootstrapStatusResponse | null;
  runtime: DeckGoRuntimeGatewayResponse | null;
  summaryError: string | null;
  refreshingSummary: boolean;
  setActivePanel: (panel: PanelId) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setThemeMode: (mode: DeckGoThemeMode) => void;
  setAuthTokenInput: (token: string) => void;
  unlockControlPlane: (token?: string) => Promise<void>;
  refreshRuntimeSummary: () => Promise<void>;
};
