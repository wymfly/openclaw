// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../i18n/provider";
import { DeckHeaderBar } from "./HeaderBar";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { DeckNavRail } from "./NavRail";
import { getBottomPanels, getPanelGroups, getShortcutPanels } from "./panel-registry";
import { PanelErrorBoundary } from "./PanelErrorBoundary";
import { useDeckShortcuts } from "./use-deck-shortcuts";

const uiState = vi.hoisted(() => ({
  activePanel: "gateway",
  bootstrap: {
    gateway: { connected: true },
    runtime: { autoStart: true, mode: "bundled", status: "running" },
  },
  mobileNavOpen: false,
  refreshingSummary: false,
  runtime: {
    runtime: { autoStart: true, mode: "bundled", status: "running" },
  },
  setActivePanel: vi.fn(),
  setMobileNavOpen: vi.fn(),
  setSidebarCollapsed: vi.fn(),
  setThemeMode: vi.fn(),
  sidebarCollapsed: false,
  summaryError: null as string | null,
  themeMode: "dark",
  toggleSidebar: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root | null = null;

vi.mock("./ui-store", () => ({
  useDeckUI: () => uiState,
}));

function installMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  });
}

function renderWithLocale(node: ReactNode, locale: "en" | "zh" = "en") {
  act(() => {
    root = createRoot(container);
    root.render(createElement(DeckIntlProvider, { locale }, node));
  });
}

function ThrowingPanel(): ReactNode {
  throw new Error("forced panel failure");
}

function ShortcutHarness() {
  const { shortcutsOpen, setShortcutsOpen } = useDeckShortcuts();
  return <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />;
}

describe("Deck shell chrome parity", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    installMatchMedia();
    uiState.activePanel = "gateway";
    uiState.bootstrap = {
      gateway: { connected: true },
      runtime: { autoStart: true, mode: "bundled", status: "running" },
    };
    uiState.mobileNavOpen = false;
    uiState.refreshingSummary = false;
    uiState.runtime = {
      runtime: { autoStart: true, mode: "bundled", status: "running" },
    };
    uiState.sidebarCollapsed = false;
    uiState.summaryError = null;
    uiState.themeMode = "dark";
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
  });

  it("keeps panel registry order, shortcuts, and bottom settings aligned with old Deck", () => {
    expect(getPanelGroups().map((group) => group.group)).toEqual([
      "core",
      "observe",
      "automate",
      "control",
    ]);
    expect(getBottomPanels().map((panel) => panel.id)).toEqual(["settings"]);
    expect(getBottomPanels()[0]?.group).toBe("control");
    expect(getShortcutPanels().map((panel) => `${panel.shortcutIndex}:${panel.id}`)).toEqual([
      "1:chat",
      "2:agents",
      "3:gateway",
      "4:models",
      "5:usage",
      "6:sessions",
      "7:memory",
      "8:logs",
      "9:activity",
    ]);
  });

  it("renders translated header title/status and routes gateway status to the gateway panel", () => {
    renderWithLocale(createElement(DeckHeaderBar), "zh");

    expect(container.textContent).toContain("监控");
    expect(container.textContent).toContain("已连接");
    act(() => {
      container.querySelector<HTMLButtonElement>(".deck-ui-status-chip")?.click();
    });

    expect(uiState.setActivePanel).toHaveBeenCalledWith("gateway");
  });

  it("renders nav groups and bottom settings through the active locale", () => {
    uiState.activePanel = "chat";

    renderWithLocale(createElement(DeckNavRail), "en");

    expect(container.querySelector("nav")?.getAttribute("aria-label")).toBe("Deck panels");
    expect(container.textContent).toContain("Core");
    expect(container.textContent).toContain("Settings");
  });

  it("uses collapsed nav titles when desktop rail is icon-only", () => {
    uiState.sidebarCollapsed = true;

    renderWithLocale(createElement(DeckNavRail), "zh");

    expect(container.querySelector('[title="对话"]')).toBeTruthy();
    expect(container.querySelector('[title="设置"]')).toBeTruthy();
  });

  it("renders localized panel error fallback and resets from the retry action", () => {
    renderWithLocale(
      createElement(
        PanelErrorBoundary,
        {
          labels: {
            description: "此面板遇到错误，其他面板不受影响。",
            details: "错误详情",
            retry: "重试",
            title: "出现错误",
          },
          resetKey: "chat",
        },
        createElement(ThrowingPanel),
      ),
      "zh",
    );

    expect(container.querySelector('[data-testid="panel-error-boundary"]')).toBeTruthy();
    expect(container.textContent).toContain("出现错误");
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="panel-error-retry"]')?.click();
    });
  });

  it("opens shortcut help with shifted slash and closes it with Escape", () => {
    renderWithLocale(createElement(ShortcutHarness), "en");

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "Slash",
          ctrlKey: true,
          key: "?",
          shiftKey: true,
        }),
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.textContent).toContain("Keyboard Shortcuts");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeFalsy();
  });
});
