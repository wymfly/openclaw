// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
      }) as const
    )[
      key as
        | "runTokensIn"
        | "runTokensOut"
        | "runTokensCache"
        | "runStreaming"
        | "runDuration"
        | "sessionTokens"
        | "status_idle"
        | "status_running"
        | "status_done"
        | "status_failed"
        | "status_killed"
        | "status_timeout"
    ] ?? key,
}));

describe("RunStatusBar session status badge", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a running badge with pulse indicator", () => {
    const { container } = render(
      createElement(RunStatusBar, {
        metadata: {
          runId: "run-1",
          durationMs: 1_000,
          usage: { input: 10, output: 20 },
        },
        sessionStatus: "running",
      }),
    );

    expect(screen.getByText("Running")).toBeTruthy();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders a failed badge label", () => {
    const { container } = render(
      createElement(RunStatusBar, {
        metadata: {
          runId: "run-1",
          durationMs: 1_000,
          usage: { input: 10, output: 20 },
        },
        sessionStatus: "failed",
      }),
    );

    expect(screen.getByText("Failed")).toBeTruthy();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});
