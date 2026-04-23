import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckGoServerEvent } from "../../../../contracts/generated/ts/deck-api.generated";
import { RestoredChatPanel } from "./RestoredChatPanel";

type StreamInvocation = {
  signal: AbortSignal;
  onStatusChange?: (status: "connecting" | "connected" | "reconnecting" | "error") => void;
  onEvent: (event: DeckGoServerEvent) => void;
};

const streamInvocations: StreamInvocation[] = [];
const fetchSessionsMock = vi.fn();
const fetchSessionPreviewsMock = vi.fn();
const fetchSessionDetailMock = vi.fn();
const fetchChatSnapshotMock = vi.fn();
const fetchChatHistoryMock = vi.fn();
const streamEventsMock = vi.fn(
  async (params: StreamInvocation) =>
    await new Promise<void>((resolve) => {
      if (params.signal.aborted) {
        resolve();
        return;
      }
      params.signal.addEventListener("abort", () => resolve(), { once: true });
    }),
);

vi.mock("../../api", () => ({
  abortChatRun: vi.fn(),
  createChatSession: vi.fn(),
  fetchChatHistory: (...args: unknown[]) => fetchChatHistoryMock(...args),
  fetchChatSnapshot: (...args: unknown[]) => fetchChatSnapshotMock(...args),
  fetchSessionDetail: (...args: unknown[]) => fetchSessionDetailMock(...args),
  fetchSessionPreviews: (...args: unknown[]) => fetchSessionPreviewsMock(...args),
  fetchSessions: (...args: unknown[]) => fetchSessionsMock(...args),
  sendChatMessage: vi.fn(),
  streamEvents: (...args: [StreamInvocation]) => {
    streamInvocations.push(args[0]);
    return streamEventsMock(...args);
  },
}));

let container: HTMLDivElement;
let root: Root | null = null;

async function waitForText(predicate: (text: string) => boolean, message: string) {
  const deadline = Date.now() + 5_000;
  let lastText = "";
  while (Date.now() < deadline) {
    lastText = container.textContent ?? "";
    if (predicate(lastText)) {
      return lastText;
    }
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });
  }
  throw new Error(`${message}\n\nLast text:\n${lastText}`);
}

beforeEach(() => {
  streamInvocations.length = 0;
  vi.clearAllMocks();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  container = document.createElement("div");
  document.body.appendChild(container);

  fetchSessionsMock.mockResolvedValue({
    sessions: [
      {
        key: "session-1",
        title: "Session 1",
        agentId: "main",
        status: "ready",
        updatedAt: 1,
      },
    ],
  });
  fetchSessionPreviewsMock.mockResolvedValue({
    previews: [
      {
        key: "session-1",
        status: "ready",
        items: [{ text: "preview text" }],
      },
    ],
  });
  fetchSessionDetailMock.mockResolvedValue({
    session: {
      key: "session-1",
      title: "Session 1",
      agentId: "main",
      status: "ready",
    },
    messages: [{ id: "detail-1", role: "assistant", content: [{ type: "text", text: "314159" }] }],
  });
  fetchChatSnapshotMock.mockResolvedValue({
    session: {
      key: "session-1",
      title: "Session 1",
      agentId: "main",
      status: "ready",
    },
    messages: [
      { id: "snapshot-1", role: "assistant", content: [{ type: "text", text: "314159" }] },
    ],
  });
  fetchChatHistoryMock.mockResolvedValue({
    messages: [{ id: "history-1", role: "assistant", content: [{ type: "text", text: "314159" }] }],
  });
});

afterEach(() => {
  vi.useRealTimers();
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container.remove();
});

describe("RestoredChatPanel", () => {
  it("restarts the stream and refreshes chat data after browser network restore", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<RestoredChatPanel />);
    });

    await waitForText(
      (text) => text.includes("Inventory ready") && text.includes("Transcript ready"),
      "restored chat panel never hydrated the initial inventory and transcript",
    );
    expect(streamInvocations.length).toBeGreaterThanOrEqual(1);
    const initialInvocationCount = streamInvocations.length;
    const activeStream = streamInvocations.at(-1)!;

    act(() => {
      activeStream.onStatusChange?.("connected");
    });
    await waitForText(
      (text) => text.includes("Stream connected"),
      "initial stream never reached connected",
    );

    act(() => {
      activeStream.onStatusChange?.("reconnecting");
    });
    await waitForText(
      (text) => text.includes("Stream reconnecting"),
      "stream state never moved into reconnecting",
    );

    const firstSignal = activeStream.signal;

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitForText(
      (text) => text.includes("browser network restored"),
      "browser online recovery notice never appeared",
    );
    expect(streamInvocations).toHaveLength(initialInvocationCount + 1);
    expect(firstSignal.aborted).toBe(true);

    act(() => {
      streamInvocations.at(-1)?.onStatusChange?.("connected");
    });

    await waitForText(
      (text) => text.includes("stream reconnected"),
      "chat panel never recorded stream reconnected after browser online recovery",
    );
    expect(fetchSessionsMock).toHaveBeenCalledTimes(2);
    expect(fetchSessionDetailMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to a controlled reload when reconnecting stays stuck", async () => {
    vi.useFakeTimers();
    const reloadMock = vi.fn();
    const originalLocation = window.location;
    const replacementLocation = Object.create(originalLocation) as Location;
    Object.defineProperty(replacementLocation, "reload", {
      configurable: true,
      value: reloadMock,
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: replacementLocation,
    });

    try {
      await act(async () => {
        root = createRoot(container);
        root.render(<RestoredChatPanel />);
      });

      await waitForText(
        (text) => text.includes("Inventory ready") && text.includes("Transcript ready"),
        "restored chat panel never hydrated before recovery fallback test",
      );

      const activeStream = streamInvocations.at(-1)!;
      act(() => {
        activeStream.onStatusChange?.("reconnecting");
      });

      await waitForText(
        (text) => text.includes("Stream reconnecting"),
        "stream never moved into reconnecting before fallback reload",
      );

      await vi.advanceTimersByTimeAsync(8_500);

      expect(reloadMock).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
