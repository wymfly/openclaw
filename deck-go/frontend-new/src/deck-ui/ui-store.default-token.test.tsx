// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../data/testing/DataFabricTestProvider";

const apiMocks = vi.hoisted(() => ({
  fetchBootstrapStatus: vi.fn(),
  fetchRuntimeGatewayStatus: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  readDefaultDeckAccessToken: vi.fn(),
  readStoredDeckAccessToken: vi.fn(),
  writeStoredDeckAccessToken: vi.fn(),
}));

vi.mock("../api", () => apiMocks);
vi.mock("../lib/deck-auth-storage", () => storageMocks);

let container: HTMLDivElement;
let root: Root | null = null;

describe("DeckUIProvider default-token unlock", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    storageMocks.readStoredDeckAccessToken.mockReturnValue(null);
    storageMocks.readDefaultDeckAccessToken.mockReturnValue("default-token");
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
    vi.clearAllMocks();
  });

  it("writes the opted-in default token before loading runtime summary", async () => {
    const { DeckUIProvider, useDeckUI } = await import("./ui-store");

    function Probe() {
      const ui = useDeckUI();
      return createElement("span", null, `${ui.summaryReady}:${ui.runtime?.runtime.status}`);
    }

    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          DataFabricTestProvider,
          null,
          createElement(
            DeckUIProvider,
            { onThemeModeChange: vi.fn(), themeMode: "light" },
            createElement(Probe),
          ),
        ),
      );
    });

    await waitFor(() => {
      expect(container.textContent).toContain("true:running");
    });
    expect(storageMocks.writeStoredDeckAccessToken).toHaveBeenCalledWith("default-token");
  });
});
