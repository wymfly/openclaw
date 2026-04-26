// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckGoServerEvent } from "../../../api";
import {
  metricsFromHealthSnapshot,
  reduceAgentMetricsEvent,
  useAgentMetricsSSE,
} from "./useAgentMetricsSSE";

const apiMocks = vi.hoisted(() => ({
  fetchAgentHealthSnapshot: vi.fn(),
  streamEvents: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;
let latestStreamParams:
  | {
      signal: AbortSignal;
      onEvent: (event: DeckGoServerEvent) => void;
    }
  | undefined;

function Harness(props: { agentId: string | null }) {
  const metrics = useAgentMetricsSSE(props.agentId);
  return (
    <output>
      {metrics.activeRuns}:{metrics.messageCount}:{metrics.lastUpdated > 0 ? "updated" : "empty"}
    </output>
  );
}

describe("useAgentMetricsSSE", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    latestStreamParams = undefined;
    apiMocks.fetchAgentHealthSnapshot.mockResolvedValue({
      agents: [{ agentId: "main", sessions: { count: 2 } }],
    });
    apiMocks.streamEvents.mockImplementation(
      (params: { signal: AbortSignal; onEvent: (event: DeckGoServerEvent) => void }) => {
        latestStreamParams = params;
        return new Promise<void>((resolve) => {
          params.signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    );
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

  it("bootstraps active runs from health and updates metrics from stream events", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(Harness, { agentId: "main" }));
    });

    await waitFor(() => expect(container.textContent).toBe("2:0:updated"));
    expect(apiMocks.fetchAgentHealthSnapshot).toHaveBeenCalledTimes(1);
    expect(apiMocks.streamEvents).toHaveBeenCalledTimes(1);

    await act(async () => {
      latestStreamParams?.onEvent({
        event: "activity.event",
        data: JSON.stringify({ agentId: "main", type: "chat" }),
      });
      latestStreamParams?.onEvent({
        event: "agent.status.changed",
        data: JSON.stringify({ agentId: "main", status: "busy" }),
      });
    });

    expect(container.textContent).toBe("3:1:updated");

    await act(async () => {
      latestStreamParams?.onEvent({
        event: "agent.status.changed",
        json: { agentId: "main", status: "idle" },
      });
    });

    expect(container.textContent).toBe("0:1:updated");
  });

  it("aborts the shared stream on unmount", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(Harness, { agentId: "main" }));
    });
    expect(latestStreamParams?.signal.aborted).toBe(false);

    await act(async () => {
      root?.unmount();
    });
    root = null;

    expect(latestStreamParams?.signal.aborted).toBe(true);
  });
});

describe("agent metrics helpers", () => {
  it("extracts health metrics by agent id or name", () => {
    expect(
      metricsFromHealthSnapshot({ agents: [{ name: "main", sessions: { count: 4 } }] }, "main", 1),
    ).toEqual({ activeRuns: 4, messageCount: 0, lastUpdated: 1 });
  });

  it("ignores malformed and unrelated stream events", () => {
    const current = { activeRuns: 1, messageCount: 2, lastUpdated: 1 };
    expect(
      reduceAgentMetricsEvent(current, "main", {
        event: "activity.event",
        data: JSON.stringify({ agentId: "other", type: "chat" }),
      }),
    ).toBe(current);
    expect(reduceAgentMetricsEvent(current, "main", { event: "activity.event", data: "{" })).toBe(
      current,
    );
  });
});
