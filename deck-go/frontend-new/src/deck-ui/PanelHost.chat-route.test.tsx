// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckPanelHost } from "./PanelHost";

const uiState = vi.hoisted(() => ({
  activePanel: "chat",
}));

vi.mock("./ui-store", () => ({
  useDeckUI: () => uiState,
}));

vi.mock("../components/panels/chat/ChatPanel", () => ({
  ChatPanel: () => "Migrated ChatPanel",
}));

vi.mock("./ActivePanelHost", () => ({
  ActivePanelHost: () => "Registered Panel Host",
}));

let container: HTMLDivElement;
let root: Root | null = null;

describe("DeckPanelHost chat route", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
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
  });

  it("routes chat directly to the migrated ChatPanel", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(DeckPanelHost));
    });

    expect(container.textContent).toContain("Migrated ChatPanel");
  });

  it("routes non-chat panels directly to the registered panel host", () => {
    uiState.activePanel = "gateway";

    act(() => {
      root = createRoot(container);
      root.render(createElement(DeckPanelHost));
    });

    expect(container.textContent).toContain("Registered Panel Host");
    expect(container.textContent).not.toContain("Provisional adapter");
  });
});
