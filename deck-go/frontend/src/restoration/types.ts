import type {
  DeckGoBootstrapStatusResponse,
  DeckGoRuntimeGatewayActionResponse,
} from "../../../contracts/generated/ts/deck-api.generated";
import type { DeckGoThemeMode } from "../theme";
import type { RestoredPanelId } from "./panel-registry";

export type RestorationUIState = {
  activePanel: RestoredPanelId;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  themeMode: DeckGoThemeMode;
  bootstrap: DeckGoBootstrapStatusResponse | null;
  runtime: DeckGoRuntimeGatewayActionResponse | null;
  summaryError: string | null;
  refreshingSummary: boolean;
  setActivePanel: (panel: RestoredPanelId) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setThemeMode: (mode: DeckGoThemeMode) => void;
  refreshRuntimeSummary: () => Promise<void>;
};
