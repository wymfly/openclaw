// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DECK_GO_THEME_TOGGLE_ORDER, useThemeMode } from "./theme";

type MatchMediaListener = (event: MediaQueryListEvent) => void;

let container: HTMLDivElement;
let root: Root | null = null;
let systemDark = false;
const listeners = new Set<MatchMediaListener>();

function ThemeProbe() {
  const theme = useThemeMode();
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "mode" }, theme.themeMode),
    createElement("span", { "data-testid": "resolved" }, theme.resolvedTheme),
    createElement("button", { onClick: () => theme.setThemeMode("dark"), type: "button" }, "dark"),
    createElement(
      "button",
      { onClick: () => theme.setThemeMode("light"), type: "button" },
      "light",
    ),
    createElement(
      "button",
      { onClick: () => theme.setThemeMode("system"), type: "button" },
      "system",
    ),
  );
}

function query(testId: string): string {
  const value = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.textContent;
  if (value == null) {
    throw new Error(`missing test id: ${testId}`);
  }
  return value;
}

function installMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: systemDark,
      media: query,
      onchange: null,
      addEventListener: (type: string, listener: MatchMediaListener) => {
        if (type === "change") {
          listeners.add(listener);
        }
      },
      removeEventListener: (type: string, listener: MatchMediaListener) => {
        if (type === "change") {
          listeners.delete(listener);
        }
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function emitSystemThemeChange(nextDark: boolean) {
  systemDark = nextDark;
  const event = { matches: nextDark, media: "(prefers-color-scheme: dark)" } as MediaQueryListEvent;
  for (const listener of listeners) {
    listener(event);
  }
}

describe("useThemeMode", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    systemDark = false;
    listeners.clear();
    window.localStorage.clear();
    document.documentElement.className = "";
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themeMode;
    delete document.documentElement.dataset.resolvedTheme;
    installMatchMedia();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    window.localStorage.clear();
    listeners.clear();
    vi.clearAllMocks();
  });

  it("defaults to system mode and persists the Vite and old Deck storage keys", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ThemeProbe));
    });

    expect(query("mode")).toBe("system");
    expect(query("resolved")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.themeMode).toBe("system");
    expect(document.documentElement.dataset.resolvedTheme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("deckGoThemeMode")).toBe("system");
    expect(window.localStorage.getItem("openclaw-deck-theme")).toBe("system");
  });

  it("reads the old Deck theme key and applies explicit dark and light modes", async () => {
    window.localStorage.setItem("openclaw-deck-theme", "dark");

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ThemeProbe));
    });

    expect(query("mode")).toBe("dark");
    expect(query("resolved")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "light")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(query("mode")).toBe("light");
    expect(query("resolved")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("deckGoThemeMode")).toBe("light");
    expect(window.localStorage.getItem("openclaw-deck-theme")).toBe("light");
  });

  it("tracks system preference changes while system mode is active", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ThemeProbe));
    });

    expect(query("mode")).toBe("system");
    expect(query("resolved")).toBe("light");

    await act(async () => {
      emitSystemThemeChange(true);
    });

    expect(query("resolved")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await act(async () => {
      emitSystemThemeChange(false);
    });

    expect(query("resolved")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("keeps the active shell/header theme toggle order aligned with old Deck semantics", () => {
    expect([...DECK_GO_THEME_TOGGLE_ORDER]).toEqual(["dark", "light", "system"]);
  });
});
