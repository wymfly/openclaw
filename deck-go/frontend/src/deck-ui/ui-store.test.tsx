// @vitest-environment jsdom
import { fireEvent } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckUIProvider, useDeckUI } from "./ui-store";

const apiMocks = vi.hoisted(() => ({
  fetchBootstrapStatus: vi.fn(),
  fetchRuntimeGatewayStatus: vi.fn(),
}));

vi.mock("../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function RuntimePreferenceProbe() {
  const ui = useDeckUI();
  return createElement(
    "div",
    null,
    createElement(
      "span",
      { "data-testid": "runtime-state" },
      `panel:${ui.activePanel}|collapsed:${String(ui.sidebarCollapsed)}`,
    ),
    createElement(
      "button",
      { onClick: () => ui.setActivePanel("agents"), type: "button" },
      "Open agents",
    ),
    createElement(
      "button",
      { onClick: () => ui.setSidebarCollapsed(false), type: "button" },
      "Expand sidebar",
    ),
  );
}

describe("DeckUIProvider runtime preferences", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchBootstrapStatus.mockResolvedValue({ ok: true });
    apiMocks.fetchRuntimeGatewayStatus.mockResolvedValue({ ok: true });
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
    vi.clearAllMocks();
  });

  it("reads retired preference keys and rewrites active runtime keys", async () => {
    window.localStorage.setItem("deckGoRestorationActivePanel", "channels");
    window.localStorage.setItem("deckGoRestorationSidebarCollapsed", "true");

    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          DeckUIProvider,
          { onThemeModeChange: vi.fn(), themeMode: "light" },
          createElement(RuntimePreferenceProbe),
        ),
      );
    });

    expect(container.textContent).toContain("panel:channels|collapsed:true");
    expect(window.localStorage.getItem("deckGoActivePanel")).toBe("channels");
    expect(window.localStorage.getItem("deckGoSidebarCollapsed")).toBe("true");
    expect(window.localStorage.getItem("deckGoRestorationActivePanel")).toBeNull();
    expect(window.localStorage.getItem("deckGoRestorationSidebarCollapsed")).toBeNull();

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Open agents",
        ) as HTMLButtonElement,
      );
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Expand sidebar",
        ) as HTMLButtonElement,
      );
    });

    expect(container.textContent).toContain("panel:agents|collapsed:false");
    expect(window.localStorage.getItem("deckGoActivePanel")).toBe("agents");
    expect(window.localStorage.getItem("deckGoSidebarCollapsed")).toBe("false");
  });
});
