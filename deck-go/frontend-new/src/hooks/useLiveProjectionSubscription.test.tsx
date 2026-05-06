// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useLiveProjectionSubscription,
  type LiveProjectionSubscriptionState,
} from "./useLiveProjectionSubscription";

const apiMocks = vi.hoisted(() => ({
  streamEvents: vi.fn(),
  streamLogEvents: vi.fn(),
}));

vi.mock("../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

type CapturedStreamParams = {
  initialLastEventId?: string;
  onEvent?: (event: { id?: string; event?: string }) => void;
  onStatusChange?: (status: "connecting" | "connected" | "reconnecting" | "error") => void;
  signal: AbortSignal;
};

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function cleanupHarness() {
  if (!root) {
    return;
  }
  act(() => {
    root?.unmount();
  });
  root = null;
}

function renderHarness(props: {
  enabled?: boolean;
  onEvent?: (event: { id?: string; event?: string }) => void;
  onProjectionGap?: () => void;
  onStatusChange?: (state: LiveProjectionSubscriptionState) => void;
}) {
  function Harness() {
    useLiveProjectionSubscription({
      projectionId: "agent-status",
      enabled: props.enabled,
      onEvent: props.onEvent,
      onProjectionGap: props.onProjectionGap,
      onStatusChange: props.onStatusChange,
      retryDelayMs: 50,
    });
    return null;
  }

  act(() => {
    root = createRoot(container);
    root.render(createElement(Harness));
  });
}

describe("useLiveProjectionSubscription", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    apiMocks.streamEvents.mockReset();
    apiMocks.streamLogEvents.mockReset();
  });

  afterEach(() => {
    cleanupHarness();
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses contract cursor storage and marks projection gaps stale", async () => {
    const states: LiveProjectionSubscriptionState[] = [];
    const onGap = vi.fn();
    window.localStorage.setItem("deckGoLiveProjection:agent-status:lastEventId", "41");
    apiMocks.streamEvents.mockImplementation(async (params: CapturedStreamParams) => {
      params.onStatusChange?.("connecting");
      return new Promise<void>((resolve) => {
        params.signal.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    renderHarness({ onProjectionGap: onGap, onStatusChange: (state) => states.push(state) });
    await flushEffects();

    expect(apiMocks.streamEvents).toHaveBeenCalledTimes(1);
    const captured = apiMocks.streamEvents.mock.calls[0]?.[0] as CapturedStreamParams;
    expect(captured.initialLastEventId).toBe("41");

    act(() => {
      captured.onStatusChange?.("connected");
      captured.onEvent?.({ id: "42", event: "agent.status.changed" });
      captured.onEvent?.({ id: "43", event: "projection.gap" });
    });
    await flushEffects();

    expect(window.localStorage.getItem("deckGoLiveProjection:agent-status:lastEventId")).toBe("43");
    expect(onGap).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toMatchObject({ status: "stale", stale: true, lastEventId: "43" });
  });

  it("marks reconnecting streams stale after the configured threshold", async () => {
    const states: LiveProjectionSubscriptionState[] = [];
    apiMocks.streamEvents.mockImplementation(async (params: CapturedStreamParams) => {
      return new Promise<void>((resolve) => {
        params.signal.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    renderHarness({ onStatusChange: (state) => states.push(state) });
    await flushEffects();

    act(() => {
      const captured = apiMocks.streamEvents.mock.calls[0]?.[0] as CapturedStreamParams;
      captured.onStatusChange?.("reconnecting");
      vi.advanceTimersByTime(30000);
    });
    await flushEffects();

    expect(states.at(-1)).toMatchObject({ status: "stale", stale: true });
  });

  it("does not connect refresh-only projections", async () => {
    function Harness() {
      useLiveProjectionSubscription({ projectionId: "routing-bindings" });
      return null;
    }

    act(() => {
      root = createRoot(container);
      root.render(createElement(Harness));
    });
    await flushEffects();

    expect(apiMocks.streamEvents).not.toHaveBeenCalled();
    expect(apiMocks.streamLogEvents).not.toHaveBeenCalled();
  });
});
