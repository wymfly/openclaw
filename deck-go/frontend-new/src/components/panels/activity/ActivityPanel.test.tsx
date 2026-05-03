// @vitest-environment jsdom
import { fireEvent } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { ActivityPanel } from "./ActivityPanel";

const apiMocks = vi.hoisted(() => ({
  fetchActivityEvents: vi.fn(),
  fetchMonitorRunDetail: vi.fn(),
  fetchMonitorRuns: vi.fn(),
  fetchMonitorStats: vi.fn(),
  streamEvents: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToAgent: vi.fn(),
  navigateToSession: vi.fn(),
  ui: { setActivePanel: vi.fn() },
}));

vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToAgent: deckUIMocks.navigateToAgent,
  navigateToSession: deckUIMocks.navigateToSession,
}));
vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));

let container: HTMLDivElement;
let root: Root | null = null;
let latestStreamParams: {
  signal: AbortSignal;
  onEvent: (event: { event?: string; data?: string; json?: unknown }) => void;
} | null = null;

const baseNow = Date.UTC(2026, 3, 24, 8, 0, 0);

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderActivityPanel() {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale: "en" }, createElement(ActivityPanel)));
}

function activityEvents() {
  return [
    {
      id: "evt-old",
      timestamp: baseNow - 60 * 60 * 1_000,
      type: "session.created",
      agentId: "main",
      agentName: "Main Agent",
      description: "Older session event",
      details: "created by main",
    },
    {
      id: "evt-new",
      timestamp: baseNow - 5 * 60 * 1_000,
      type: "run.completed",
      agentId: "builder",
      agentName: "Builder Agent",
      description: "Newest run event",
      details: "completed by builder",
    },
  ];
}

describe("ActivityPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchActivityEvents.mockResolvedValue({ events: activityEvents() });
    apiMocks.fetchMonitorRuns.mockResolvedValue({
      nextCursor: null,
      runs: [
        {
          runId: "run-1",
          agentId: "main",
          sessionKey: "agent:main:web",
          firstEventAt: "2026-04-24T07:50:00.000Z",
          lastEventAt: "2026-04-24T07:55:00.000Z",
          eventCount: 2,
          status: "completed",
          toolCalls: 1,
          modelCalls: 1,
          totalTokens: 42,
        },
      ],
    });
    apiMocks.fetchMonitorRunDetail.mockResolvedValue({
      summary: {
        toolCalls: 1,
        modelCalls: 1,
        fileOps: 2,
        subagentSpawns: 1,
        compacted: true,
        totalTokens: 42,
        totalInputTokens: 1000,
        totalOutputTokens: 234,
        totalCacheTokens: 50,
        durationMs: 300000,
        eventCount: 2,
      },
      events: [
        {
          id: 1,
          run_id: "run-1",
          seq: 1,
          stream: "status",
          data: "started",
          agent_id: "main",
          session_key: "agent:main:web",
          created_at: "2026-04-24T07:50:00.000Z",
        },
        {
          id: 2,
          run_id: "run-1",
          seq: 2,
          stream: "model",
          data: JSON.stringify({
            fallback: true,
            model: "gpt-5.4",
            usage: {
              cache_read_input_tokens: 50,
              input_tokens: 1000,
              output_tokens: 234,
            },
          }),
          agent_id: "main",
          session_key: "agent:main:web",
          created_at: "2026-04-24T07:51:00.000Z",
        },
        {
          id: 3,
          run_id: "run-1",
          seq: 3,
          stream: "tool_call",
          data: JSON.stringify({
            durationMs: 1200,
            phase: "complete",
            toolName: "apply_patch",
          }),
          agent_id: "main",
          session_key: "agent:main:web",
          created_at: "2026-04-24T07:52:00.000Z",
        },
        {
          id: 4,
          run_id: "run-1",
          seq: 4,
          stream: "file_op",
          data: JSON.stringify({
            path: "src/app.ts",
            toolName: "edit_file",
          }),
          agent_id: "main",
          session_key: "agent:main:web",
          created_at: "2026-04-24T07:53:00.000Z",
        },
        {
          id: 5,
          run_id: "run-1",
          seq: 5,
          stream: "subagent",
          data: JSON.stringify({
            agentId: "builder",
            runId: "child-1",
            status: "completed",
            task: "check release",
          }),
          agent_id: "main",
          session_key: "agent:main:web",
          created_at: "2026-04-24T07:54:00.000Z",
        },
      ],
    });
    apiMocks.fetchMonitorStats.mockResolvedValue({
      totalRuns: 8,
      todayRuns: 2,
      avgDurationMs: 1234,
      topAgents: [{ agentId: "main", runCount: 5 }],
    });
    latestStreamParams = null;
    apiMocks.streamEvents.mockImplementation(async (params: typeof latestStreamParams) => {
      latestStreamParams = params;
    });
    deckUIMocks.navigateToAgent.mockClear();
    deckUIMocks.navigateToSession.mockClear();
    deckUIMocks.ui.setActivePanel.mockClear();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("loads, sorts, and selects activity events from the deck-go activity API", async () => {
    await act(async () => {
      renderActivityPanel();
    });
    await flushEffects();
    await flushEffects();

    expect(container.querySelector(".activity-panel")).not.toBeNull();
    expect(container.querySelectorAll(".activity-panel__card").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll(".activity-panel__surface").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".activity-panel__row").length).toBeGreaterThanOrEqual(2);

    const eventButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".activity-panel__list button"),
    );
    expect(apiMocks.fetchActivityEvents).toHaveBeenCalledWith(100);
    expect(container.textContent).toContain("Activity ready");
    expect(container.textContent).toContain("2 loaded");
    expect(container.textContent).toContain("Today (2)");
    expect(eventButtons).toHaveLength(2);
    expect(eventButtons[0]?.textContent).toContain("Newest run event");
    expect(container.textContent).toContain("evt-new");
    expect(container.textContent).toContain("completed by builder");
  });

  it("loads monitor run history and selected run detail from the current monitor API", async () => {
    await act(async () => {
      renderActivityPanel();
    });

    expect(apiMocks.fetchMonitorRuns).toHaveBeenCalledWith({ limit: 50 });
    expect(apiMocks.fetchMonitorRunDetail).toHaveBeenCalledWith("run-1");
    expect(apiMocks.fetchMonitorStats).toHaveBeenCalled();
    expect(container.textContent).toContain("Run history");
    expect(container.textContent).toContain("Runs ready");
    expect(container.textContent).toContain("Stats ready");
    expect(container.textContent).toContain("total runs");
    expect(container.textContent).toContain("1s");
    expect(container.textContent).toContain("main 5");
    expect(container.textContent).toContain("run-1");
    expect(container.textContent).toContain("tools 1 | models 1 | tokens 42");
    expect(container.textContent).toContain("Selected run");
    expect(container.textContent).toContain("events 2");
    expect(container.textContent).toContain("file ops");
    expect(container.textContent).toContain("subagents");
    expect(container.textContent).toContain("5m 0s");
    expect(container.textContent).toContain("1,000");
    expect(container.textContent).toContain("compacted");
    expect(container.textContent).toContain("yes");
    expect(container.textContent).toContain("Model stats");
    expect(container.textContent).toContain("gpt-5.4");
    expect(container.textContent).toContain("fallback used");
    expect(container.textContent).toContain("Tool calls");
    expect(container.textContent).toContain("apply_patch");
    expect(container.textContent).toContain("File operations");
    expect(container.textContent).toContain("src/app.ts");
    expect(container.textContent).toContain("Subagent events");
    expect(container.textContent).toContain("child-1");
    expect(container.textContent).toContain("check release");
    expect(container.textContent).toContain("started");
  });

  it("renders first-run empty states for activity and monitor Gateway data", async () => {
    const notConfigured = new Error("gateway_not_configured: runtime gateway is not configured");
    apiMocks.fetchActivityEvents.mockRejectedValue(notConfigured);
    apiMocks.fetchMonitorRuns.mockRejectedValue(notConfigured);

    await act(async () => {
      renderActivityPanel();
    });
    await flushEffects();
    await flushEffects();

    expect(container.querySelector('[data-testid="empty-state-not-configured"]')).toBeTruthy();
    expect(
      container.querySelectorAll('[data-testid="empty-state-not-configured"]').length,
    ).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain(
      "Open Settings and save a remote endpoint before loading Gateway data.",
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toContain("gateway_not_configured");
    expect(apiMocks.fetchMonitorRunDetail).not.toHaveBeenCalled();
  });

  it("passes monitor run history filters through the current monitor API", async () => {
    await act(async () => {
      renderActivityPanel();
    });

    const runAgentFilter = container.querySelector<HTMLInputElement>(
      'input[placeholder="run agent id"]',
    );
    const runSessionFilter = container.querySelector<HTMLInputElement>(
      'input[placeholder="run session key"]',
    );
    const runStatusFilter = container.querySelector<HTMLSelectElement>(
      'select[aria-label="run status filter"]',
    );
    const runTimeRange = container.querySelector<HTMLSelectElement>(
      'select[aria-label="run time range"]',
    );

    expect(runAgentFilter).toBeTruthy();
    expect(runSessionFilter).toBeTruthy();
    expect(runStatusFilter).toBeTruthy();
    expect(runTimeRange).toBeTruthy();

    await act(async () => {
      fireEvent.change(runAgentFilter as HTMLInputElement, { target: { value: "main" } });
    });

    await flushEffects();

    expect(apiMocks.fetchMonitorRuns).toHaveBeenLastCalledWith({
      agentId: "main",
      limit: 50,
    });

    await act(async () => {
      fireEvent.change(runSessionFilter as HTMLInputElement, {
        target: { value: "agent:main:web" },
      });
      fireEvent.change(runStatusFilter as HTMLSelectElement, {
        target: { value: "completed" },
      });
      fireEvent.change(runTimeRange as HTMLSelectElement, { target: { value: "1h" } });
    });

    await flushEffects();

    expect(apiMocks.fetchMonitorRuns).toHaveBeenLastCalledWith({
      agentId: "main",
      limit: 50,
      sessionKey: "agent:main:web",
      since: new Date(baseNow - 60 * 60 * 1_000).toISOString(),
      status: "completed",
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Clear run filters")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await flushEffects();

    expect(apiMocks.fetchMonitorRuns).toHaveBeenLastCalledWith({ limit: 50 });
  });

  it("loads the next monitor run history page through cursor pagination", async () => {
    apiMocks.fetchMonitorRuns
      .mockResolvedValueOnce({
        nextCursor: "run-1",
        runs: [
          {
            runId: "run-1",
            agentId: "main",
            sessionKey: "agent:main:web",
            firstEventAt: "2026-04-24T07:50:00.000Z",
            lastEventAt: "2026-04-24T07:55:00.000Z",
            eventCount: 2,
            status: "completed",
            toolCalls: 1,
            modelCalls: 1,
            totalTokens: 42,
          },
        ],
      })
      .mockResolvedValueOnce({
        nextCursor: null,
        runs: [
          {
            runId: "run-2",
            agentId: "builder",
            sessionKey: "agent:builder:web",
            firstEventAt: "2026-04-24T07:40:00.000Z",
            lastEventAt: "2026-04-24T07:45:00.000Z",
            eventCount: 1,
            status: "running",
            toolCalls: 0,
            modelCalls: 1,
            totalTokens: 7,
          },
        ],
      });

    await act(async () => {
      renderActivityPanel();
    });
    await flushEffects();

    expect(container.textContent).toContain("Load more runs");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Load more runs")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await flushEffects();

    expect(apiMocks.fetchMonitorRuns).toHaveBeenLastCalledWith({
      cursor: "run-1",
      limit: 50,
    });
    expect(container.textContent).toContain("run-2");
  });

  it("opens activity and run agent/session context through shared deck navigation", async () => {
    await act(async () => {
      renderActivityPanel();
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open event agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(deckUIMocks.ui, "builder");

    await act(async () => {
      await Promise.resolve();
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open run agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToAgent).toHaveBeenLastCalledWith(deckUIMocks.ui, "main");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open run session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToSession).toHaveBeenCalledWith(deckUIMocks.ui, "agent:main:web");
  });

  it("groups visible activity by time bucket and collapses groups independently", async () => {
    await act(async () => {
      renderActivityPanel();
    });

    const groupButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) =>
        button.className.includes("activity-panel__group-button") &&
        button.textContent?.includes("Today (2)"),
    );
    expect(groupButton).toBeTruthy();
    expect(groupButton?.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      groupButton?.click();
    });

    expect(groupButton?.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelectorAll<HTMLButtonElement>(".activity-panel__list button"),
    ).toHaveLength(0);
    expect(container.textContent).toContain("evt-new");
  });

  it("filters by agent and event type while preserving selected details", async () => {
    await act(async () => {
      renderActivityPanel();
    });

    const agentFilter = container.querySelector<HTMLInputElement>(
      'input[placeholder="agent id or name"]',
    );
    expect(agentFilter).toBeTruthy();

    await act(async () => {
      fireEvent.change(agentFilter as HTMLInputElement, { target: { value: "main" } });
    });

    expect(container.textContent).toContain("1 visible");
    expect(container.textContent).toContain("Older session event");
    expect(container.textContent).not.toContain("Newest run event");
    expect(container.textContent).toContain("evt-old");

    const typeFilter = Array.from(container.querySelectorAll<HTMLSelectElement>("select")).find(
      (select) => select.value === "",
    );
    expect(typeFilter).toBeTruthy();

    await act(async () => {
      fireEvent.change(typeFilter as HTMLSelectElement, {
        target: { value: "run.completed" },
      });
    });

    expect(container.textContent).toContain("No activity events match the current filters.");
  });

  it("merges realtime activity.event payloads from the shared deck stream", async () => {
    await act(async () => {
      renderActivityPanel();
    });

    expect(apiMocks.streamEvents).toHaveBeenCalled();
    expect(latestStreamParams?.signal.aborted).toBe(false);

    await act(async () => {
      latestStreamParams?.onEvent({
        event: "activity.event",
        data: JSON.stringify({
          id: "evt-live",
          timestamp: baseNow + 1_000,
          type: "tool_call",
          agentId: "live",
          agentName: "Live Agent",
          description: "Live streamed tool event",
          details: { command: "npm test" },
        }),
      });
    });

    const eventButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".activity-panel__list button"),
    );
    expect(container.textContent).toContain("3 loaded");
    expect(container.textContent).toContain("Live streamed tool event");
    expect(eventButtons[0]?.textContent).toContain("Live streamed tool event");

    await act(async () => {
      eventButtons[0]?.click();
    });

    expect(container.textContent).toContain('"command":"npm test"');
  });
});
