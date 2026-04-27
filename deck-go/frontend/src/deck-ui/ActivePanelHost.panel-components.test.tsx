// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../i18n/provider";
import { ActivePanelHost } from "./ActivePanelHost";

const uiState = vi.hoisted(() => ({
  activePanel: "gateway",
  bootstrap: null,
  runtime: null,
}));

const bridgeCalls = vi.hoisted(() => ({
  renderIds: [] as string[],
}));

vi.mock("./ui-store", () => ({
  useDeckUI: () => uiState,
}));

vi.mock("./panel-readiness", () => ({
  getPanelReadiness: () => ({ evidence: "Panel ready", status: "ready" }),
}));

vi.mock("./panel-component-registry", () => ({
  renderPanelComponent: (id: string) => {
    bridgeCalls.renderIds.push(id);
    return id === "gateway" ? "Gateway Panel" : null;
  },
}));

let container: HTMLDivElement;
let root: Root | null = null;

describe("ActivePanelHost panel components", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    uiState.activePanel = "gateway";
    bridgeCalls.renderIds.length = 0;
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

  it("delegates non-chat panels through the panel component registry", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(DeckIntlProvider, { locale: "en" }, createElement(ActivePanelHost)),
      );
    });

    expect(container.textContent).toContain("Gateway Panel");
    expect(bridgeCalls.renderIds).toEqual(["gateway"]);
  });

  it("renders fallback host copy without transitional wording", () => {
    uiState.activePanel = "docs";

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(DeckIntlProvider, { locale: "en" }, createElement(ActivePanelHost)),
      );
    });

    expect(container.textContent).toContain("Deck panel host keyed to the active panel registry");
    expect(container.textContent).toContain("Panel ready");
    expect(container.textContent).not.toContain("Migrated panel host");
    expect(container.textContent).not.toContain("Preview the migrated");
  });
});
