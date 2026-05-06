// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { GatewayPanel } from "./GatewayPanel";

const apiMocks = vi.hoisted(() => ({
  fetchActivityEvents: vi.fn(),
  fetchCapabilities: vi.fn(),
  fetchGatewayDescribe: vi.fn(),
  fetchGatewayHealth: vi.fn(),
  fetchGatewayStatus: vi.fn(),
  fetchMonitorRuns: vi.fn(),
  fetchMonitorStats: vi.fn(),
  isBundledRuntimeStatus: (runtime: { mode?: string } | null | undefined) =>
    runtime?.mode === "bundled",
  isRemoteRuntimeStatus: (runtime: { mode?: string } | null | undefined) =>
    runtime?.mode === "remote",
  submitGatewayBatch: vi.fn(),
}));

const refreshRuntimeSummary = vi.hoisted(() => vi.fn());
const bootstrapSummary = vi.hoisted(() => ({
  gateway: { connected: true },
  ok: true,
  runtime: {
    autoStart: true,
    configured: true,
    gatewayUrl: "ws://127.0.0.1:18789",
    health: "healthy",
    mode: "bundled",
    status: "running",
  },
}));
const runtimeSummary = vi.hoisted(() => ({
  autoStart: true,
  configured: true,
  gatewayUrl: "ws://127.0.0.1:18789",
  health: "healthy",
  lastConnectedAt: "",
  lastError: "",
  latencyP50: 0,
  mode: "bundled",
  ownershipState: "owned",
  pid: 1234,
  restartAttempts: 0,
  status: "running",
  tlsVerified: true,
}));

vi.mock("../../../api", () => apiMocks);

vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => ({
    bootstrap: bootstrapSummary,
    refreshRuntimeSummary,
    refreshingSummary: false,
    runtime: {
      runtime: runtimeSummary,
    },
  }),
}));

let container: HTMLDivElement;
let root: Root | null = null;

async function renderPanel(locale: "en" | "zh" = "en") {
  await act(async () => {
    root = createRoot(container);
    root.render(createElement(DeckIntlProvider, { locale }, createElement(GatewayPanel)));
  });
  await waitFor(() => expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalled());
}

function clickButton(matcher: RegExp) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    matcher.test(candidate.textContent ?? ""),
  );
  expect(button, `button ${matcher} should exist`).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function fillInput(label: string, value: string) {
  const input = Array.from(container.querySelectorAll("input")).find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
  expect(input, `input ${label} should exist`).toBeTruthy();
  act(() => {
    if (input) {
      fireEvent.change(input, { target: { value } });
    }
  });
}

describe("GatewayPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);

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
    bootstrapSummary.ok = true;
    bootstrapSummary.runtime.mode = "bundled";
    bootstrapSummary.runtime.status = "running";
    bootstrapSummary.runtime.health = "healthy";
    bootstrapSummary.runtime.configured = true;
    bootstrapSummary.runtime.gatewayUrl = "ws://127.0.0.1:18789";

    apiMocks.fetchCapabilities.mockResolvedValue({
      configured: true,
      endpointMutable: false,
      mode: "bundled",
      supervisorState: true,
    });
    apiMocks.fetchGatewayHealth.mockResolvedValue({
      agents: [{ id: "main", sessions: { count: 2 } }],
      channelLabels: { discord: "Discord", telegram: "Telegram" },
      channelOrder: ["discord", "telegram"],
      channels: { discord: "connected", telegram: { configured: true } },
      defaultAgentId: "main",
      durationMs: 17,
      heartbeatSeconds: 30,
      ok: true,
      ts: 1_761_234_567_000,
    });
    apiMocks.fetchGatewayStatus.mockResolvedValue({
      channels: { discord: "connected" },
      heartbeat: {
        agents: [{ agentId: "main", enabled: true, every: "30m" }],
        defaultAgentId: "main",
      },
      linkChannel: { authAgeMs: 4000, label: "Discord" },
      queuedSystemEvents: ["activity.flush"],
      runtimeVersion: "openclaw-test",
      sessions: { count: 3, defaults: { model: "gpt-5.4" } },
      state: "active",
    });
    apiMocks.fetchGatewayDescribe.mockResolvedValue({
      events: {
        "activity.event": { payload: { type: "object" }, since: 1 },
      },
      methods: {
        "agents.list": { result: { type: "object" }, scope: "operator.read" },
        "gateway.batch": { scope: "operator.read" },
        "gateway.describe": {
          params: { includeSchemas: "boolean" },
          result: { methods: "object" },
          scope: "operator.read",
        },
        "sessions.create": { scope: "operator.write" },
      },
      protocolVersion: 3,
      untyped: ["internal.diag.dump"],
    });
    apiMocks.fetchActivityEvents.mockResolvedValue({
      events: [
        {
          agentId: "main",
          agentName: "Main Agent",
          description: "Chat run completed",
          details: "run-1 · agent:main:latest",
          id: "event-1",
          timestamp: 1_761_234_567_000,
          type: "chat",
        },
      ],
    });
    apiMocks.fetchMonitorRuns.mockResolvedValue({
      runs: [
        {
          agentId: "main",
          eventCount: 4,
          firstEventAt: "2026-04-27T08:00:00Z",
          lastEventAt: "2026-04-27T08:00:04Z",
          modelCalls: 1,
          runId: "run-1",
          sessionKey: "agent:main:latest",
          status: "completed",
          toolCalls: 2,
          totalTokens: 1200,
        },
      ],
    });
    apiMocks.fetchMonitorStats.mockResolvedValue({
      avgDurationMs: 2500,
      todayRuns: 2,
      topAgents: [{ agentId: "main", runCount: 2 }],
      totalRuns: 3,
    });
    apiMocks.submitGatewayBatch.mockResolvedValue({
      requestId: "batch-1",
      results: [{ id: "c1", ok: true, result: { protocol: 3 } }],
      runtimeId: "rt_local",
    });
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

  it("renders the v2 Gateway control plane from BFF diagnostics and projections", async () => {
    await renderPanel();

    await waitFor(() => expect(container.textContent).toContain("Gateway control plane"));
    expect(container.textContent).toContain("openclaw-test");
    expect(container.textContent).toContain("30s");
    expect(container.textContent).toContain("gpt-5.4");
    expect(container.textContent).toContain("Discord");
    expect(container.textContent).toContain("Telegram");
    expect(container.textContent).toContain("gateway.describe");
    expect(container.textContent).toContain("internal.diag.dump");
    expect(container.textContent).toContain("Throughput projection");
    expect(container.textContent).toContain("Runtime Gateway");
    expect(container.textContent).toContain("ws://127.0.0.1:18789");
    expect(container.textContent).not.toMatch(/\b(Start|Stop|Restart)\b/);
    expect(container.querySelector(".gateway-app__topbar")).toBeTruthy();
    expect(container.querySelector(".describe-explorer")).toBeTruthy();
    expect(container.querySelector("[style]")).toBeNull();
    expect(apiMocks.fetchGatewayHealth).toHaveBeenCalled();
    expect(apiMocks.fetchGatewayStatus).toHaveBeenCalled();
    expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalled();
    expect(apiMocks.fetchActivityEvents).toHaveBeenCalledWith(20);
    expect(apiMocks.fetchMonitorRuns).toHaveBeenCalledWith({ limit: 20 });
    expect(apiMocks.fetchMonitorStats).toHaveBeenCalled();
  });

  it("filters describe methods, switches events, and localizes relative time copy", async () => {
    await renderPanel("zh");

    await waitFor(() => expect(container.textContent).toContain("Gateway 控制平面"));
    fillInput("搜索", "gateway.describe");
    const describeList = container.querySelector(".describe-explorer__list");
    expect(describeList?.textContent).toContain("gateway.describe");
    expect(describeList?.textContent).not.toContain("agents.list");

    fillInput("搜索", "");
    clickButton(/^事件/);
    await waitFor(() => expect(container.textContent).toContain("activity.event"));
    expect(container.textContent).toContain("载荷");

    clickButton(/批量控制台/);
    clickButton(/执行批量/);
    await waitFor(() => expect(apiMocks.submitGatewayBatch).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toContain("batch-1"));
    expect(container.textContent).toContain("刚刚");

    clickButton(/^活动/);
    expect(container.textContent).toContain("最近活动");
    expect(container.textContent).toContain("天前");
    expect(container.textContent).not.toContain(" ago");
  });

  it("submits only safe read-only calls through the runtime-scoped batch wrapper", async () => {
    await renderPanel();
    clickButton(/Batch console/);

    await waitFor(() => expect(container.textContent).toContain("Run batch"));
    expect(container.textContent).toContain("Bundled-mode composer");
    expect(Array.from(container.querySelectorAll("option")).map((option) => option.value)).toEqual([
      "agents.list",
      "gateway.describe",
    ]);

    clickButton(/Run batch/);

    await waitFor(() => expect(apiMocks.submitGatewayBatch).toHaveBeenCalled());
    expect(apiMocks.submitGatewayBatch).toHaveBeenCalledWith(
      {
        calls: [
          {
            id: "c1",
            method: "gateway.describe",
            params: { includeSchemas: false },
          },
        ],
        options: { failFast: false, timeoutMs: 5000 },
      },
      { runtimeId: "rt_local" },
    );
    await waitFor(() => expect(container.textContent).toContain("batch-1"));
    expect(container.textContent).toContain('"protocol": 3');
  });

  it("locks batch execution in remote mode while keeping diagnostics visible", async () => {
    apiMocks.fetchCapabilities.mockResolvedValue({
      configured: true,
      endpointMutable: true,
      mode: "remote",
      supervisorState: false,
    });
    runtimeSummary.mode = "remote";
    runtimeSummary.status = "" as "running";
    runtimeSummary.health = "" as "healthy";
    runtimeSummary.gatewayUrl = "" as "ws://127.0.0.1:18789";
    runtimeSummary.pid = undefined as unknown as number;
    runtimeSummary.lastConnectedAt = "2026-04-28T10:00:00Z";
    runtimeSummary.latencyP50 = 24;
    runtimeSummary.tlsVerified = true;
    bootstrapSummary.runtime.mode = "remote";

    await renderPanel();
    clickButton(/Batch console/);

    await waitFor(() =>
      expect(container.textContent).toContain(
        "Remote mode is read-only here; batch execution is disabled from this panel.",
      ),
    );
    expect(apiMocks.submitGatewayBatch).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Remote connection");
    expect(container.textContent).toContain("2026-04-28T10:00:00Z");
  });

  it("renders first-run empty state without surfacing raw gateway_not_configured errors", async () => {
    const notConfigured = new Error("gateway_not_configured: runtime gateway is not configured");
    apiMocks.fetchGatewayHealth.mockRejectedValue(notConfigured);
    apiMocks.fetchGatewayStatus.mockRejectedValue(notConfigured);
    apiMocks.fetchGatewayDescribe.mockRejectedValue(notConfigured);
    apiMocks.fetchActivityEvents.mockRejectedValue(notConfigured);
    apiMocks.fetchMonitorRuns.mockRejectedValue(notConfigured);
    apiMocks.fetchMonitorStats.mockRejectedValue(notConfigured);

    await renderPanel();

    await waitFor(() =>
      expect(container.querySelector('[data-testid="empty-state-not-configured"]')).toBeTruthy(),
    );
    expect(container.textContent).toContain(
      "Open Settings and save a remote endpoint before loading Gateway data.",
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toContain("gateway_not_configured");
  });

  it("keeps health and status evidence visible when describe temporarily fails", async () => {
    apiMocks.fetchGatewayDescribe.mockRejectedValue(new Error("describe timeout"));

    await renderPanel();

    await waitFor(() => expect(container.textContent).toContain("Describe unavailable"));
    expect(container.textContent).toContain("Gateway control plane");
    expect(container.textContent).toContain("Gateway OK");
    expect(container.textContent).toContain("Throughput projection");
    expect(container.querySelector('[data-testid="empty-state-not-configured"]')).toBeNull();
  });
});
