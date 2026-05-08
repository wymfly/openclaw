// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../data/testing/DataFabricTestProvider";
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

function RuntimeSummaryProbe() {
  const ui = useDeckUI();
  return createElement(
    "div",
    null,
    createElement(
      "span",
      { "data-testid": "summary" },
      [
        `ready:${String(ui.summaryReady)}`,
        `auth:${String(ui.authRequired)}`,
        `error:${ui.summaryError ?? "none"}`,
        `runtime:${ui.runtime?.runtime.status ?? "none"}`,
      ].join("|"),
    ),
    createElement(
      "button",
      { onClick: () => void ui.refreshRuntimeSummary(), type: "button" },
      "Refresh runtime",
    ),
  );
}

function renderWithDeckUI(node: ReactNode) {
  root = createRoot(container);
  root.render(
    createElement(
      DataFabricTestProvider,
      null,
      createElement(DeckUIProvider, { onThemeModeChange: vi.fn(), themeMode: "light" }, node),
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
    apiMocks.fetchBootstrapStatus.mockResolvedValue({
      ok: true,
      runtime: { status: "running" },
    });
    apiMocks.fetchRuntimeGatewayStatus.mockResolvedValue({
      ok: true,
      runtime: { status: "running" },
    });
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
      renderWithDeckUI(createElement(RuntimePreferenceProbe));
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

  it("loads runtime summary through Data Fabric and keeps the public state shape", async () => {
    await act(async () => {
      renderWithDeckUI(createElement(RuntimeSummaryProbe));
    });

    await waitFor(() => {
      expect(container.textContent).toContain("ready:true|auth:false|error:none|runtime:running");
    });
    expect(apiMocks.fetchBootstrapStatus).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchRuntimeGatewayStatus).toHaveBeenCalledTimes(1);
  });

  it("keeps cached summary data visible when a manual background refresh fails", async () => {
    apiMocks.fetchBootstrapStatus
      .mockResolvedValueOnce({ ok: true, runtime: { status: "running" } })
      .mockRejectedValueOnce(new Error("server unavailable"));
    apiMocks.fetchRuntimeGatewayStatus
      .mockResolvedValueOnce({ ok: true, runtime: { status: "running" } })
      .mockRejectedValueOnce(new Error("server unavailable"));

    await act(async () => {
      renderWithDeckUI(createElement(RuntimeSummaryProbe));
    });

    await waitFor(() => {
      expect(container.textContent).toContain("runtime:running");
    });

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Refresh runtime",
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() => {
      expect(container.textContent).toContain(
        "ready:true|auth:false|error:server unavailable|runtime:running",
      );
    });
  });

  it("preserves auth-required behavior for runtime summary failures", async () => {
    apiMocks.fetchBootstrapStatus.mockRejectedValue(new Error("unauthorized"));
    apiMocks.fetchRuntimeGatewayStatus.mockRejectedValue(new Error("unauthorized"));

    await act(async () => {
      renderWithDeckUI(createElement(RuntimeSummaryProbe));
    });

    await waitFor(() => {
      expect(container.textContent).toContain("ready:true|auth:true|error:none|runtime:none");
    });
  });
});
