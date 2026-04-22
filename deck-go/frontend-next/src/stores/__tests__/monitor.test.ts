import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMonitorStore } from "../monitor";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  mockFetch.mockReset();
  useMonitorStore.setState({
    activeTab: "overview",
    selectedRunId: null,
    runs: [],
    runsLoading: false,
    nextCursor: null,
    runSummary: null,
    runEvents: [],
    runDetailLoading: false,
    liveEvents: [],
    liveEventsLoading: false,
    stats: null,
    statsLoading: false,
    filters: {
      agentId: null,
      sessionKey: null,
      since: null,
      until: null,
      status: null,
    },
    gatewayStatus: "disconnected",
    gatewayLatency: null,
    healthSummary: null,
    statusSummary: null,
    runtimeGateway: null,
    runtimeGatewayLoading: false,
    runtimeGatewayAction: "idle",
    runtimeGatewayError: null,
    healthLoading: false,
    statusLoading: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("monitor store runtime gateway lifecycle", () => {
  it("fetchRuntimeGateway stores the backend runtime truth", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          runtime: {
            managed: true,
            configured: true,
            status: "running",
            health: "healthy",
            gatewayUrl: "ws://127.0.0.1:18789",
          },
        }),
        { status: 200 },
      ),
    );

    await useMonitorStore.getState().fetchRuntimeGateway();

    const state = useMonitorStore.getState();
    expect(state.runtimeGateway).toEqual({
      managed: true,
      configured: true,
      status: "running",
      health: "healthy",
      gatewayUrl: "ws://127.0.0.1:18789",
    });
    expect(state.runtimeGatewayError).toBeNull();
    expect(state.runtimeGatewayLoading).toBe(false);
  });

  it("fetchRuntimeGateway preserves runtime payload on non-ok responses", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error: "runtime unavailable",
          runtime: {
            managed: true,
            configured: true,
            status: "failed",
            health: "unhealthy",
            lastError: "spawn failed",
          },
        }),
        { status: 502 },
      ),
    );

    await useMonitorStore.getState().fetchRuntimeGateway();

    const state = useMonitorStore.getState();
    expect(state.runtimeGateway?.status).toBe("failed");
    expect(state.runtimeGateway?.lastError).toBe("spawn failed");
    expect(state.runtimeGatewayError).toBe("runtime unavailable");
  });

  it("startRuntimeGateway exposes in-flight action state and refreshes diagnostics", async () => {
    let resolveAction: ((value: Response) => void) | undefined;

    mockFetch
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveAction = resolve;
          }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            durationMs: 8,
            agents: [],
            channels: {},
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            heartbeat: "ok",
            state: "active",
          }),
          { status: 200 },
        ),
      );

    const actionPromise = useMonitorStore.getState().startRuntimeGateway();
    expect(useMonitorStore.getState().runtimeGatewayAction).toBe("starting");

    resolveAction?.(
      new Response(
        JSON.stringify({
          ok: true,
          runtime: {
            managed: true,
            configured: true,
            status: "running",
            health: "healthy",
            gatewayUrl: "ws://127.0.0.1:18789",
          },
        }),
        { status: 200 },
      ),
    );

    await actionPromise;

    const state = useMonitorStore.getState();
    expect(state.runtimeGatewayAction).toBe("idle");
    expect(state.runtimeGateway?.status).toBe("running");
    expect(state.gatewayStatus).toBe("connected");
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[0]?.[0]).toBe("/api/runtime/gateway/start");
    expect(mockFetch.mock.calls[1]?.[0]).toBe("/api/gateway/health");
    expect(mockFetch.mock.calls[2]?.[0]).toBe("/api/gateway/status");
  });
});
