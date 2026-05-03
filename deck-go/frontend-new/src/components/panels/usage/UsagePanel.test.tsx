// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { UsagePanel } from "./UsagePanel";

const apiMocks = vi.hoisted(() => ({
  fetchModelUsageCost: vi.fn(),
  fetchModelUsageProviders: vi.fn(),
  fetchUsageSessionLogs: vi.fn(),
  fetchUsageSessions: vi.fn(),
  fetchUsageTimeseries: vi.fn(),
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

const baseTime = Date.UTC(2026, 3, 24, 10, 30, 0);

function costPayload() {
  return {
    days: 14,
    daily: [
      { date: "2026-04-23", totalCost: 3.25 },
      { date: "2026-04-22", cost: 1.25 },
    ],
  };
}

function providersPayload() {
  return {
    providers: [
      {
        provider: "openai",
        displayName: "OpenAI",
        plan: "team",
        windows: [
          { label: "daily", usedPercent: 40, resetAt: baseTime + 24 * 60 * 60 * 1_000 },
          { label: "hourly", usedPercent: 90, resetAt: baseTime + 2 * 60 * 60 * 1_000 },
        ],
      },
      {
        provider: "anthropic",
        displayName: "Anthropic",
        plan: "pro",
        windows: [{ label: "daily", usedPercent: 50, resetAt: baseTime + 60 * 60 * 1_000 }],
      },
    ],
  };
}

function contextWeightPayload() {
  return {
    source: "run",
    generatedAt: baseTime,
    systemPrompt: {
      chars: 2_000,
      nonProjectContextChars: 800,
      projectContextChars: 1_200,
    },
    tools: {
      entries: [{ name: "tool_search", schemaChars: 700, summaryChars: 50 }],
      listChars: 300,
      schemaChars: 700,
    },
    skills: {
      entries: [{ name: "usage-skill", blockChars: 400 }],
      promptChars: 400,
    },
    injectedWorkspaceFiles: [
      {
        injectedChars: 100,
        missing: false,
        name: "AGENTS.md",
        path: "AGENTS.md",
        rawChars: 100,
        truncated: false,
      },
    ],
  };
}

function usageSessionsPayload() {
  return {
    updatedAt: baseTime,
    startDate: "2026-04-22",
    endDate: "2026-04-24",
    totals: { input: 100, output: 50, totalTokens: 150, totalCost: 4.75 },
    sessions: [
      {
        key: "sess-main",
        label: "Main Session",
        sessionId: "session-main",
        agentId: "main",
        channel: "web",
        updatedAt: baseTime,
        usage: { input: 80, output: 40, totalTokens: 120, totalCost: 4 },
      },
      {
        key: "sess-build",
        label: "Builder Session",
        sessionId: "session-build",
        agentId: "builder",
        channel: "web",
        contextWeight: contextWeightPayload(),
        updatedAt: baseTime - 1_000,
        usage: { input: 20, output: 10, totalTokens: 30, totalCost: 0.75 },
      },
    ],
    aggregates: {
      byAgent: [{ agentId: "main", totals: { totalTokens: 120, totalCost: 4 } }],
      byChannel: [{ channel: "web", totals: { totalTokens: 150, totalCost: 4.75 } }],
      byModel: [{ model: "gpt-5.4", totals: { totalTokens: 150, totalCost: 4.75 } }],
      byProvider: [{ provider: "openai", totals: { totalTokens: 150, totalCost: 4.75 } }],
      daily: [
        {
          cost: 4.75,
          date: "2026-04-24",
          errors: 1,
          messages: 10,
          tokens: 150,
          toolCalls: 3,
        },
      ],
      modelDaily: [
        {
          cost: 4,
          count: 1,
          date: "2026-04-24",
          model: "gpt-5.4",
          provider: "openai",
          tokens: 120,
        },
        {
          cost: 0.75,
          count: 1,
          date: "2026-04-24",
          model: "gpt-5.4-mini",
          provider: "openai",
          tokens: 30,
        },
      ],
      latency: { avgMs: 120, count: 10, maxMs: 500, minMs: 20, p95Ms: 250 },
      messages: {
        assistant: 4,
        errors: 1,
        toolCalls: 3,
        toolResults: 2,
        total: 10,
        user: 3,
      },
      tools: {
        tools: [
          { count: 2, name: "search" },
          { count: 1, name: "read_file" },
        ],
        totalCalls: 3,
        uniqueTools: 2,
      },
    },
  };
}

function usageSessionLogsPayload() {
  return {
    logs: [
      {
        timestamp: baseTime,
        role: "assistant",
        content: "usage log detail",
        tokens: 12,
        cost: 0.2,
      },
    ],
  };
}

function usageTimeseriesPayload() {
  return {
    sessionId: "session-build",
    points: [
      {
        timestamp: baseTime,
        input: 5,
        output: 7,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 12,
        cost: 0.2,
        cumulativeTokens: 12,
        cumulativeCost: 0.2,
      },
    ],
  };
}

function renderUsagePanel() {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale: "en" }, createElement(UsagePanel)));
}

describe("UsagePanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchModelUsageCost.mockResolvedValue(costPayload());
    apiMocks.fetchModelUsageProviders.mockResolvedValue(providersPayload());
    apiMocks.fetchUsageSessions.mockResolvedValue(usageSessionsPayload());
    apiMocks.fetchUsageSessionLogs.mockResolvedValue(usageSessionLogsPayload());
    apiMocks.fetchUsageTimeseries.mockResolvedValue(usageTimeseriesPayload());
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
    vi.clearAllMocks();
  });

  it("loads cost totals and provider pressure from the usage APIs", async () => {
    await act(async () => {
      renderUsagePanel();
    });

    await waitFor(() => expect(apiMocks.fetchModelUsageProviders).toHaveBeenCalledTimes(1));

    expect(apiMocks.fetchModelUsageCost).toHaveBeenCalledWith(14);
    expect(apiMocks.fetchUsageSessions).toHaveBeenCalledWith({
      endDate: expect.any(String),
      limit: 50,
      startDate: expect.any(String),
    });
    expect(container.textContent).toContain("Usage ready");
    expect(container.querySelector(".usage-panel")).not.toBeNull();
    expect(container.querySelector(".usage-panel__header")).not.toBeNull();
    expect(container.querySelector(".usage-panel__workbench")).not.toBeNull();
    expect(container.querySelectorAll(".usage-panel__metric")).toHaveLength(6);
    expect(container.querySelectorAll(".usage-panel__card").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll(".deck-ui-usage-surface").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll(".deck-ui-usage-input")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-usage-chart-row").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".deck-ui-usage-row").length).toBeGreaterThanOrEqual(8);
    expect(container.textContent).toContain("2 days");
    expect(container.textContent).toContain("2 providers");
    expect(container.textContent).toContain("$4.50");
    expect(container.textContent).toContain("2026-04-22");
    expect(container.textContent).toContain("2026-04-23");
    expect(container.textContent).toContain("Usage trend");
    expect(container.textContent).toContain("Tokens");
    expect(container.textContent).toContain("Cost");
    expect(container.textContent).toContain("By model");
    expect(container.textContent).toContain("150 tokens");
    expect(container.textContent).toContain("10 messages | 3 tool calls | 1 errors");
    expect(container.textContent).toContain("Highest pressure window");
    expect(container.textContent).toContain("openai");
    expect(container.textContent).toContain("hourly");
    expect(container.textContent).toContain("90% used");
    expect(container.textContent).toContain("resets in");
    expect(container.textContent).toContain("Session usage drilldown");
    expect(container.textContent).toContain("150");
    expect(container.textContent).toContain("$4.75");
    expect(container.textContent).toContain("Main Session");
    expect(container.textContent).toContain("Usage aggregates");
    expect(container.textContent).toContain("model: gpt-5.4");
    expect(container.textContent).toContain("Usage behavior signals");
    expect(container.textContent).toContain("250ms");
    expect(container.textContent).toContain("search");
    expect(container.textContent).toContain("2026-04-24");
    expect(container.textContent).toContain("1 errors");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "By model")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("gpt-5.4");
    expect(container.textContent).toContain("gpt-5.4-mini");
    expect(container.textContent).toContain("1 runs | $4.00");
  });

  it("refreshes with the requested day range and preserves a valid provider selection", async () => {
    await act(async () => {
      renderUsagePanel();
    });

    await waitFor(() => expect(apiMocks.fetchModelUsageProviders).toHaveBeenCalledTimes(1));

    const anthropicButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Anthropic"),
    );
    expect(anthropicButton).toBeTruthy();

    await act(async () => {
      anthropicButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(anthropicButton?.className).toContain("is-selected");

    const sevenDayRange = container.querySelector<HTMLButtonElement>('[data-usage-range="7"]');
    expect(sevenDayRange).toBeTruthy();

    await act(async () => {
      sevenDayRange?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchModelUsageCost).toHaveBeenLastCalledWith(7));
    expect(sevenDayRange?.className).toContain("is-primary");

    const daysInput = container.querySelector<HTMLInputElement>('input[placeholder="days"]');
    expect(daysInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(daysInput as HTMLInputElement, { target: { value: "30" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Refresh usage")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchModelUsageCost).toHaveBeenLastCalledWith(30));
    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Anthropic");
  });

  it("filters session usage and loads logs for the expanded session", async () => {
    await act(async () => {
      renderUsagePanel();
    });

    await waitFor(() => expect(apiMocks.fetchUsageSessions).toHaveBeenCalledTimes(1));

    const sessionSearch = container.querySelector<HTMLInputElement>(
      'input[placeholder="search usage sessions"]',
    );
    expect(sessionSearch).toBeTruthy();

    await act(async () => {
      fireEvent.change(sessionSearch as HTMLInputElement, { target: { value: "builder" } });
    });

    expect(container.textContent).toContain("Builder Session");
    expect(container.textContent).not.toContain("Main Session");

    const builderButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Builder Session"),
    );
    expect(builderButton).toBeTruthy();

    await act(async () => {
      builderButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchUsageSessionLogs).toHaveBeenCalledWith({
        key: "sess-build",
        limit: 50,
      }),
    );
    expect(apiMocks.fetchUsageTimeseries).toHaveBeenCalledWith({ key: "sess-build" });
    expect(apiMocks.fetchUsageSessions).toHaveBeenCalledWith({
      includeContextWeight: true,
      key: "sess-build",
      limit: 1,
    });
    expect(container.textContent).toContain("Session logs");
    expect(container.textContent).toContain("usage log detail");
    expect(container.textContent).toContain("12 tokens");
    expect(container.textContent).toContain("Usage timeseries");
    expect(container.textContent).toContain("cumulative 12 tokens");
    expect(container.textContent).toContain("Context weight");
    expect(container.textContent).toContain("3.5K");
    expect(container.textContent).toContain("system prompt");
    expect(container.textContent).toContain("tools");
  });

  it("opens expanded usage session agent and session through shared deck navigation", async () => {
    await act(async () => {
      renderUsagePanel();
    });

    await waitFor(() => expect(apiMocks.fetchUsageSessions).toHaveBeenCalledTimes(1));

    const builderButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Builder Session"),
    );
    expect(builderButton).toBeTruthy();

    await act(async () => {
      builderButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchUsageSessionLogs).toHaveBeenCalledWith({
        key: "sess-build",
        limit: 50,
      }),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open usage agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(deckUIMocks.ui, "builder");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open usage session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToSession).toHaveBeenCalledWith(deckUIMocks.ui, "sess-build");
  });
});
