// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayPanel } from "./GatewayPanel";

const apiMocks = vi.hoisted(() => ({
  fetchGatewayHealth: vi.fn(),
  fetchGatewayStatus: vi.fn(),
  fetchSettings: vi.fn(),
  startRuntimeGateway: vi.fn(),
  restartRuntimeGateway: vi.fn(),
  stopRuntimeGateway: vi.fn(),
}));

const refreshRuntimeSummary = vi.hoisted(() => vi.fn());
const runtimeSummary = vi.hoisted(() => ({
  status: "running",
  health: "healthy",
  gatewayUrl: "ws://127.0.0.1:18789",
  pid: 1234,
  configured: true,
}));

vi.mock("../../../api", () => apiMocks);

vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => ({
    bootstrap: {
      gateway: { connected: true },
      runtime: { status: "running", health: "healthy" },
    },
    runtime: {
      runtime: runtimeSummary,
    },
    refreshingSummary: false,
    refreshRuntimeSummary,
  }),
}));

let container: HTMLDivElement;
let root: Root | null = null;

describe("GatewayPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchSettings.mockResolvedValue({
      path: "/tmp/deck-go.json",
      settings: {
        accessToken: "token",
        managedGateway: {
          mode: "managed",
          command: "pnpm",
          args: ["openclaw", "gateway", "run"],
          workingDir: "/tmp/openclaw",
          bindHost: "127.0.0.1",
          bindPort: 18789,
          gatewayToken: "gateway-token",
          autoStart: true,
          env: {},
        },
      },
    });
    apiMocks.fetchGatewayHealth.mockResolvedValue({
      ok: true,
      durationMs: 17,
      agents: [{ id: "main", sessions: { count: 2 } }],
      channels: { discord: "connected", telegram: { configured: true } },
    });
    apiMocks.fetchGatewayStatus.mockResolvedValue({
      state: "active",
      heartbeat: {
        agents: [{ agentId: "main", enabled: true, every: "30m" }],
        defaultAgentId: "main",
      },
      sessions: { count: 3 },
      channels: { discord: "connected" },
    });
    apiMocks.startRuntimeGateway.mockResolvedValue({ runtime: { status: "running" } });
    apiMocks.restartRuntimeGateway.mockResolvedValue({ runtime: { status: "running" } });
    apiMocks.stopRuntimeGateway.mockResolvedValue({ runtime: { status: "stopped" } });
    runtimeSummary.status = "running";
    runtimeSummary.health = "healthy";
    runtimeSummary.gatewayUrl = "ws://127.0.0.1:18789";
    runtimeSummary.pid = 1234;
    runtimeSummary.configured = true;
    refreshRuntimeSummary.mockResolvedValue(undefined);
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

  it("renders runtime and managed gateway settings from deck-go APIs", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(GatewayPanel));
    });

    expect(container.textContent).toContain("Gateway runtime");
    expect(container.textContent).toContain("status running");
    expect(container.textContent).toContain("ws://127.0.0.1:18789");
    expect(container.textContent).toContain("Managed gateway settings");
    expect(container.textContent).toContain("pnpm");
    expect(container.textContent).toContain("Gateway health diagnostics");
    expect(container.textContent).toContain("latency: 17 ms");
    expect(container.textContent).toContain("agents: 1 | sessions: 2 | channels: 2");
    expect(container.textContent).toContain("Gateway status summary");
    expect(container.textContent).toContain("state: active | heartbeat: 1/1 enabled");
    expect(container.textContent).toContain("default main");
    expect(container.textContent).toContain("30m");
    expect(container.textContent).toContain("sessions: 3 | channels: 1");
    expect(container.querySelector(".deck-ui-gateway")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-gateway-card")).toHaveLength(4);
    expect(container.querySelectorAll(".deck-ui-gateway-body")).toHaveLength(4);
    expect(container.querySelectorAll(".deck-ui-gateway-status-row")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-gateway-surface")).toHaveLength(4);
    expect(container.querySelectorAll(".deck-ui-gateway-hero")).toHaveLength(1);
    expect(container.querySelectorAll(".deck-ui-gateway-actions")).toHaveLength(1);
    expect(container.querySelectorAll(".deck-ui-gateway-button")).toHaveLength(4);
    expect(container.querySelector("[style]")).toBeNull();
    expect(apiMocks.fetchSettings).toHaveBeenCalled();
    expect(apiMocks.fetchGatewayHealth).toHaveBeenCalled();
    expect(apiMocks.fetchGatewayStatus).toHaveBeenCalled();
  });

  it("gates runtime actions by current gateway state", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(GatewayPanel));
    });

    const startButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Start",
    );
    const restartButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Restart",
    );
    const stopButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Stop",
    );

    expect(startButton?.disabled).toBe(true);
    expect(restartButton?.disabled).toBe(false);
    expect(stopButton?.disabled).toBe(false);
  });

  it("starts a stopped managed gateway and refreshes runtime summary", async () => {
    runtimeSummary.status = "stopped";
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(GatewayPanel));
    });

    const fetchCountBeforeStart = apiMocks.fetchSettings.mock.calls.length;
    const startButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Start",
    );
    expect(startButton).toBeTruthy();
    expect(startButton?.disabled).toBe(false);

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(apiMocks.startRuntimeGateway).toHaveBeenCalledTimes(1);
    expect(refreshRuntimeSummary).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchSettings.mock.calls.length).toBeGreaterThan(fetchCountBeforeStart);
    expect(apiMocks.fetchGatewayHealth).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchGatewayStatus).toHaveBeenCalledTimes(2);
  });
});
