// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunStatusBar } from "../RunStatusBar";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        runTokensIn: "In",
        runTokensOut: "Out",
        runTokensCache: "Cache",
        runStreaming: "Streaming",
        runDuration: "Duration",
        sessionTokens: "Session",
        status_idle: "Idle",
        status_running: "Running",
        status_done: "Done",
        status_failed: "Failed",
        status_killed: "Killed",
        status_timeout: "Timeout",
      }) as Record<string, string>
    )[key] ?? key,
}));

describe("RunStatusBar session status badge", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
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

  it("renders a running badge with pulse indicator", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(RunStatusBar, {
          metadata: {
            runId: "run-1",
            durationMs: 1_000,
            usage: { input: 10, output: 20 },
          },
          sessionStatus: "running",
        }),
      );
    });

    expect(container.textContent).toContain("Running");
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders a failed badge label without pulse indicator", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(RunStatusBar, {
          metadata: {
            runId: "run-1",
            durationMs: 1_000,
            usage: { input: 10, output: 20 },
          },
          sessionStatus: "failed",
        }),
      );
    });

    expect(container.textContent).toContain("Failed");
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("renders cache tokens and live streaming elapsed time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(RunStatusBar, {
          metadata: {
            runId: "run-1",
            durationMs: 1_000,
            startedAt: 7_000,
            streaming: true,
            usage: { input: 10, output: 20, cache: 30 },
          },
          sessionStatus: "running",
        }),
      );
    });

    expect(container.textContent).toContain("Cache 30");
    expect(container.textContent).toContain("Streaming 3s");

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(container.textContent).toContain("Streaming 4s");
  });
});
