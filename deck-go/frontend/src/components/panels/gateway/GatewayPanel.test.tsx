// @vitest-environment jsdom
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

function findButtonText(pattern: RegExp) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    pattern.test(button.textContent ?? ""),
  );
}

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

    expect(container.textContent).toMatch(/Monitor|监控面板/);
    expect(container.textContent).toMatch(/status running|运行状态 running/);
    expect(container.textContent).toContain("ws://127.0.0.1:18789");
    expect(container.textContent).toMatch(/Managed gateway settings|托管 Gateway 设置/);
    expect(container.textContent).toContain("pnpm");
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
    expect(container.querySelectorAll(".deck-ui-gateway-button")).toHaveLength(4);
    expect(container.querySelector("[style]")).toBeNull();
    expect(apiMocks.fetchSettings).toHaveBeenCalled();
    expect(apiMocks.fetchGatewayHealth).toHaveBeenCalled();
    expect(apiMocks.fetchGatewayStatus).toHaveBeenCalled();
    expect(apiMocks.fetchActivityEvents).toHaveBeenCalledWith(20);
    expect(apiMocks.fetchMonitorRuns).toHaveBeenCalledWith({ limit: 20 });
    expect(apiMocks.fetchMonitorStats).toHaveBeenCalled();
  });

  it("gates runtime actions by current gateway state", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(GatewayPanel));
    });

    const startButton = findButtonText(/^(Start|启动)$/);
    const restartButton = findButtonText(/^(Restart|重启)$/);
    const stopButton = findButtonText(/^(Stop|停止)$/);

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
    const startButton = findButtonText(/^(Start|启动)$/);
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
    expect(apiMocks.fetchMonitorRuns).toHaveBeenCalledTimes(2);
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
