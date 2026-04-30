// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayPanel } from "./GatewayPanel";

const apiMocks = vi.hoisted(() => ({
  fetchActivityEvents: vi.fn(),
  fetchGatewayHealth: vi.fn(),
  fetchGatewayStatus: vi.fn(),
  fetchMonitorRunDetail: vi.fn(),
  fetchMonitorRuns: vi.fn(),
  fetchMonitorStats: vi.fn(),
  fetchCapabilities: vi.fn(),
  isBundledRuntimeStatus: (runtime: { mode?: string } | null | undefined) =>
    runtime?.mode === "bundled",
  isRemoteRuntimeStatus: (runtime: { mode?: string } | null | undefined) =>
    runtime?.mode === "remote",
}));

const refreshRuntimeSummary = vi.hoisted(() => vi.fn());
const bootstrapSummary = vi.hoisted(() => ({
  gateway: { connected: true },
  runtime: { status: "running", health: "healthy", autoStart: true, mode: "bundled" },
}));
const runtimeSummary = vi.hoisted(() => ({
  status: "running",
  health: "healthy",
  gatewayUrl: "ws://127.0.0.1:18789",
  pid: 1234,
  configured: true,
  autoStart: true,
  ownershipState: "owned",
  restartAttempts: 0,
  lastConnectedAt: "",
  lastError: "",
  latencyP50: 0,
  mode: "bundled",
  tlsVerified: true,
}));

vi.mock("../../../api", () => apiMocks);

vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => ({
    bootstrap: bootstrapSummary,
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
    apiMocks.fetchCapabilities.mockResolvedValue({
      mode: "bundled",
      configured: true,
      endpointMutable: false,
      supervisorState: true,
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
    apiMocks.fetchActivityEvents.mockResolvedValue({
      events: [
        {
          id: "event-1",
          timestamp: 1_761_234_567_000,
          type: "chat",
          agentId: "main",
          agentName: "Main Agent",
          description: "Chat run completed",
          details: "run-1 · agent:main:latest",
        },
      ],
    });
    apiMocks.fetchMonitorRuns.mockResolvedValue({
      runs: [
        {
          runId: "run-1",
          agentId: "main",
          sessionKey: "agent:main:latest",
          firstEventAt: "2026-04-27T08:00:00Z",
          lastEventAt: "2026-04-27T08:00:04Z",
          eventCount: 4,
          status: "completed",
          toolCalls: 2,
          modelCalls: 1,
          totalTokens: 1200,
        },
      ],
    });
    apiMocks.fetchMonitorStats.mockResolvedValue({
      totalRuns: 3,
      todayRuns: 2,
      avgDurationMs: 2500,
      topAgents: [{ agentId: "main", runCount: 2 }],
    });
    apiMocks.fetchMonitorRunDetail.mockResolvedValue({
      summary: {
        eventCount: 4,
        durationMs: 4000,
        toolCalls: 2,
        modelCalls: 1,
        fileOps: 1,
        subagentSpawns: 1,
        totalTokens: 1200,
      },
      events: [
        {
          id: 1,
          run_id: "run-1",
          seq: 1,
          stream: "activity.event",
          data: JSON.stringify({ type: "chat", description: "Chat completed" }),
          agent_id: "main",
          session_key: "agent:main:latest",
          created_at: "2026-04-27T08:00:00Z",
        },
      ],
    });
    runtimeSummary.mode = "bundled";
    runtimeSummary.status = "running";
    runtimeSummary.health = "healthy";
    runtimeSummary.gatewayUrl = "ws://127.0.0.1:18789";
    runtimeSummary.pid = 1234;
    runtimeSummary.configured = true;
    runtimeSummary.autoStart = true;
    runtimeSummary.ownershipState = "owned";
    runtimeSummary.restartAttempts = 0;
    runtimeSummary.lastConnectedAt = "";
    runtimeSummary.lastError = "";
    runtimeSummary.latencyP50 = 0;
    runtimeSummary.tlsVerified = true;
    bootstrapSummary.gateway.connected = true;
    bootstrapSummary.runtime.status = "running";
    bootstrapSummary.runtime.health = "healthy";
    bootstrapSummary.runtime.autoStart = true;
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

  it("renders bundled runtime summary and Gateway diagnostics from deck-go APIs", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(GatewayPanel));
    });

    await waitFor(() => expect(apiMocks.fetchCapabilities).toHaveBeenCalled());
    expect(container.textContent).toMatch(/Monitor|监控面板/);
    expect(container.textContent).toMatch(/status running|运行状态 running/);
    expect(container.textContent).toContain("ws://127.0.0.1:18789");
    expect(container.textContent).toMatch(/Runtime summary|运行时摘要/);
    expect(container.textContent).toMatch(/Bundled supervisor|本机 supervisor/);
    expect(container.textContent).not.toMatch(/^(Start|启动|Stop|停止|Restart|重启)$/);
    expect(container.textContent).toMatch(/Gateway health diagnostics|Gateway 健康诊断/);
    expect(container.textContent).toMatch(/latency: 17 ms|延迟: 17 ms/);
    expect(container.textContent).toMatch(
      /agents: 1 \| sessions: 2 \| channels: 2|智能体: 1 \| 活跃会话: 2 \| 渠道状态: 2/,
    );
    expect(container.textContent).toMatch(/Gateway status summary|Gateway 状态摘要/);
    expect(container.textContent).toMatch(
      /state: active \| heartbeat: 1\/1 enabled|状态: active \| 心跳监控: 1\/1 已启用/,
    );
    expect(container.textContent).toMatch(/default main|默认 main/);
    expect(container.textContent).toContain("30m");
    expect(container.textContent).toMatch(/sessions: 3 \| channels: 1|活跃会话: 3 \| 渠道状态: 1/);
    expect(container.textContent).toMatch(/Live Feed|实时事件流/);
    expect(container.textContent).toContain("Chat run completed");
    expect(container.textContent).toContain("run-1 · agent:main:latest");
    expect(container.querySelector(".deck-ui-gateway")).toBeTruthy();
    expect(container.querySelector(".deck-ui-gateway-tabs")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-gateway-card").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll(".deck-ui-gateway-body").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll(".deck-ui-gateway-status-row")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-gateway-surface").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll(".deck-ui-gateway-hero")).toHaveLength(1);
    expect(container.querySelectorAll(".deck-ui-gateway-actions")).toHaveLength(1);
    expect(container.querySelectorAll(".deck-ui-gateway-button")).toHaveLength(1);
    expect(container.querySelector("[style]")).toBeNull();
    expect(apiMocks.fetchGatewayHealth).toHaveBeenCalled();
    expect(apiMocks.fetchGatewayStatus).toHaveBeenCalled();
    expect(apiMocks.fetchActivityEvents).toHaveBeenCalledWith(20);
    expect(apiMocks.fetchMonitorRuns).toHaveBeenCalledWith({ limit: 20 });
    expect(apiMocks.fetchMonitorStats).toHaveBeenCalled();
  });

  it("renders no Gateway lifecycle action buttons", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(GatewayPanel));
    });

    const labels = Array.from(container.querySelectorAll("button")).map((button) =>
      button.textContent?.trim(),
    );
    expect(labels).not.toContain("Start");
    expect(labels).not.toContain("Restart");
    expect(labels).not.toContain("Stop");
    expect(labels).not.toContain("启动");
    expect(labels).not.toContain("重启");
    expect(labels).not.toContain("停止");
  });

  it.each([
    {
      name: "connected",
      status: "running",
      health: "healthy",
      connected: true,
      ownership: "owned",
      restarts: 0,
      autoStart: true,
      gatewayText: /gateway Connected|网关 已连接/,
      canStart: false,
      canRestart: true,
      canStop: true,
    },
    {
      name: "reconnecting",
      status: "starting",
      health: "unhealthy",
      connected: false,
      ownership: "owned",
      restarts: 1,
      autoStart: true,
      gatewayText: /gateway pending|网关 待连接/,
      canStart: false,
      canRestart: false,
      canStop: true,
    },
    {
      name: "degraded",
      status: "degraded",
      health: "unhealthy",
      connected: false,
      ownership: "owned",
      restarts: 2,
      autoStart: true,
      gatewayText: /gateway pending|网关 待连接/,
      canStart: true,
      canRestart: true,
      canStop: true,
    },
    {
      name: "failed",
      status: "failed",
      health: "unknown",
      connected: false,
      ownership: "none",
      restarts: 3,
      autoStart: true,
      gatewayText: /gateway pending|网关 待连接/,
      canStart: true,
      canRestart: true,
      canStop: true,
    },
    {
      name: "port-conflict",
      status: "failed",
      health: "unknown",
      connected: false,
      ownership: "external",
      restarts: 0,
      autoStart: true,
      gatewayText: /gateway pending|网关 待连接/,
      canStart: true,
      canRestart: true,
      canStop: true,
    },
    {
      name: "autostart-disabled",
      status: "stopped",
      health: "unknown",
      connected: false,
      ownership: "none",
      restarts: 0,
      autoStart: false,
      gatewayText: /gateway pending|网关 待连接/,
      canStart: true,
      canRestart: false,
      canStop: false,
    },
  ])(
    "renders managed runtime state matrix row: $name",
    async ({ status, health, connected, ownership, restarts, gatewayText }) => {
      runtimeSummary.status = status;
      runtimeSummary.health = health;
      runtimeSummary.ownershipState = ownership;
      runtimeSummary.restartAttempts = restarts;
      bootstrapSummary.gateway.connected = connected;
      bootstrapSummary.runtime.status = status;
      bootstrapSummary.runtime.health = health;

      await act(async () => {
        root = createRoot(container);
        root.render(createElement(GatewayPanel));
      });

      expect(container.textContent).toMatch(new RegExp(`(status|运行状态) ${status}`));
      expect(container.textContent).toMatch(new RegExp(`(Health|健康度) ${health}`));
      expect(container.textContent).toMatch(gatewayText);
      expect(container.textContent).toMatch(new RegExp(`(owner|归属) ${ownership}`));
      expect(container.textContent).toMatch(new RegExp(`(restarts|重启) ${restarts}`));
    },
  );

  it("renders remote runtime field set when supervisor state is absent", async () => {
    apiMocks.fetchCapabilities.mockResolvedValue({
      mode: "remote",
      configured: true,
      endpointMutable: true,
      supervisorState: false,
    });
    runtimeSummary.mode = "remote";
    runtimeSummary.status = undefined as unknown as string;
    runtimeSummary.health = undefined as unknown as string;
    runtimeSummary.gatewayUrl = undefined as unknown as string;
    runtimeSummary.pid = undefined as unknown as number;
    runtimeSummary.ownershipState = undefined as unknown as "owned";
    runtimeSummary.restartAttempts = undefined as unknown as number;
    runtimeSummary.lastConnectedAt = "2026-04-28T10:00:00Z";
    runtimeSummary.lastError = "";
    runtimeSummary.latencyP50 = 24;
    runtimeSummary.tlsVerified = true;

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(GatewayPanel));
    });

    await waitFor(() => expect(container.textContent).toMatch(/Remote connection|远程连接/));
    expect(container.textContent).toContain("2026-04-28T10:00:00Z");
    expect(container.textContent).toContain("24 ms");
    expect(container.textContent).toMatch(/TLS verified|TLS 已验证/);
    expect(container.textContent).not.toMatch(/Bundled supervisor|本机 supervisor/);
  });

  it("renders first-run empty state instead of Gateway data errors", async () => {
    const notConfigured = new Error("gateway_not_configured: runtime gateway is not configured");
    apiMocks.fetchGatewayHealth.mockRejectedValue(notConfigured);
    apiMocks.fetchGatewayStatus.mockRejectedValue(notConfigured);
    apiMocks.fetchActivityEvents.mockRejectedValue(notConfigured);
    apiMocks.fetchMonitorRuns.mockRejectedValue(notConfigured);

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(GatewayPanel));
    });

    await waitFor(() =>
      expect(container.querySelector('[data-testid="empty-state-not-configured"]')).toBeTruthy(),
    );
    expect(container.textContent).toMatch(
      /Open Settings and save a remote endpoint before loading Gateway data\.|请打开设置并保存远程端点后再加载 Gateway 数据。/,
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toContain("gateway_not_configured");
  });

  it("renders old Monitor history and loads timeline detail from run selection", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(GatewayPanel));
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-controls="deck-ui-gateway-history"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toMatch(/Total Runs|总运行数/);
    expect(container.textContent).toContain("run-1");
    expect(container.textContent).toMatch(
      /events 4 \| tools 2 \| models 1 \| tokens 1200|事件 4 \| 工具 2 \| 模型 1 \| 令牌 1200/,
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("run-1"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(apiMocks.fetchMonitorRunDetail).toHaveBeenCalledWith("run-1");
    expect(container.textContent).toMatch(/Run Timeline|运行时间线/);
    expect(container.textContent).toMatch(/Tool Waterfall|工具调用瀑布/);
    expect(container.textContent).toMatch(/File Changes|文件变更/);
    expect(container.textContent).toMatch(/Model Stats|模型统计/);
    expect(container.textContent).toContain("Chat completed");
  });
});
