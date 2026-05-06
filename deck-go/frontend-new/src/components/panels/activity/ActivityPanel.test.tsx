// @vitest-environment jsdom
import { fireEvent } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { ActivityPanel } from "./ActivityPanel";

const apiMocks = vi.hoisted(() => ({
  fetchActivityEvents: vi.fn(),
  streamEvents: vi.fn(),
  streamLogEvents: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;
let latestStreamParams: {
  signal: AbortSignal;
  onEvent: (event: { event?: string; data?: string; id?: string; json?: unknown }) => void;
} | null = null;

const baseNow = Date.UTC(2026, 3, 24, 8, 0, 0);
const writeText = vi.fn();

function activityEvents() {
  return [
    {
      id: "evt-tool",
      timestamp: baseNow - 5 * 60 * 1_000,
      type: "tool.call",
      agentId: "main",
      agentName: "Main Agent",
      description: "Tool call requested",
      details: "apply_patch src/app.ts",
    },
    {
      id: "evt-error",
      timestamp: baseNow - 10 * 60 * 1_000,
      type: "channel.error",
      description: "Channel failed to reconnect",
      details: "transport timeout",
    },
    {
      id: "evt-run",
      timestamp: baseNow - 30 * 60 * 1_000,
      type: "run.completed",
      agentId: "builder",
      agentName: "Builder",
      description: "Run completed",
      details: "session=agent:builder:web",
    },
    {
      id: "evt-unknown",
      timestamp: baseNow - 3 * 60 * 60 * 1_000,
      type: "mystery.event",
      description: "Unknown system event",
      details: "still inspectable",
    },
  ];
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderActivityPanel(locale: "en" | "zh" = "en") {
  root = createRoot(container);
  await act(async () => {
    root?.render(createElement(DeckIntlProvider, { locale }, createElement(ActivityPanel)));
  });
  await flushEffects();
}

function text() {
  return container.textContent ?? "";
}

function buttonByText(label: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.includes(label),
  );
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
    latestStreamParams = null;
    apiMocks.streamEvents.mockImplementation(async (params: typeof latestStreamParams) => {
      latestStreamParams = params;
    });
    apiMocks.streamLogEvents.mockResolvedValue(undefined);
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
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
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the active prototype structure from the activity BFF only", async () => {
    await renderActivityPanel();

    expect(container.querySelector('[data-testid="activity-panel"]')).toBeTruthy();
    expect(apiMocks.fetchActivityEvents).toHaveBeenCalledWith(100);
    expect(text()).toContain("Activity");
    expect(text()).toContain("Unified timeline");
    expect(text()).toContain("Events");
    expect(text()).toContain("Errors");
    expect(text()).toContain("Warnings");
    expect(container.querySelector('.activity-seg[aria-label="Family filter"]')).toBeTruthy();
    expect(container.querySelector('.activity-seg[aria-label="Severity filter"]')).toBeTruthy();
    expect(text()).toContain("Tool call requested");
    expect(text()).toContain("Unknown system event");
    expect(text()).not.toContain("Run history");
    expect(text()).not.toContain("Selected run");
  });

  it("composes family, severity, time, and search filters with recoverable empty state", async () => {
    await renderActivityPanel();

    buttonByText("Channels")?.click();
    await flushEffects();
    buttonByText("Errors")?.click();
    await flushEffects();
    expect(text()).toContain("Channel failed to reconnect");
    expect(text()).not.toContain("Tool call requested");

    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    expect(search).toBeTruthy();
    fireEvent.change(search as HTMLInputElement, { target: { value: "no-match" } });
    await flushEffects();
    expect(text()).toContain("No activity events match the current filters.");

    buttonByText("Clear filters")?.click();
    await flushEffects();
    expect(text()).toContain("Tool call requested");
    expect(text()).toContain("Channel failed to reconnect");
  });

  it("opens the event detail dialog, copies raw JSON, and closes it", async () => {
    await renderActivityPanel();

    buttonByText("Tool call requested")?.click();
    await flushEffects();

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(text()).toContain("Raw event");
    expect(text()).toContain("apply_patch src/app.ts");

    buttonByText("Copy JSON")?.click();
    await flushEffects();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"id": "evt-tool"'));

    buttonByText("Close")?.click();
    await flushEffects();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("merges activity.event stream payloads without duplicating event ids", async () => {
    await renderActivityPanel();

    expect(apiMocks.streamEvents).toHaveBeenCalled();
    expect(latestStreamParams?.signal.aborted).toBe(false);

    await act(async () => {
      latestStreamParams?.onEvent({
        event: "activity.event",
        id: "stream-1",
        data: JSON.stringify({
          id: "evt-live",
          timestamp: baseNow + 1_000,
          type: "tool.result",
          agentId: "live",
          agentName: "Live Agent",
          description: "Live streamed tool result",
          details: { command: "npm test" },
        }),
      });
    });

    expect(text()).toContain("5 loaded");
    expect(text()).toContain("Live streamed tool result");

    await act(async () => {
      latestStreamParams?.onEvent({
        event: "activity.event",
        id: "stream-2",
        data: JSON.stringify({
          id: "evt-live",
          timestamp: baseNow + 2_000,
          type: "tool.result",
          description: "Live streamed tool result",
        }),
      });
    });

    expect(text()).toContain("5 loaded");
  });

  it("renders Gateway first-run and Chinese localized states", async () => {
    const notConfigured = new Error("gateway_not_configured: runtime gateway is not configured");
    apiMocks.fetchActivityEvents.mockRejectedValue(notConfigured);

    await renderActivityPanel("zh");

    expect(text()).toContain("动态");
    expect(container.querySelector('[data-testid="empty-state-not-configured"]')).toBeTruthy();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
