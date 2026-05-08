// @vitest-environment jsdom
import { fireEvent } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
import { DeckIntlProvider } from "../../../i18n/provider";
import { LogsPanel } from "./LogsPanel";

type CapturedLogStreamParams = {
  signal: AbortSignal;
  initialLastEventId?: string;
  onStatusChange(status: "idle" | "connecting" | "connected" | "reconnecting" | "error"): void;
  onEvent(event: { id?: string; event?: string; json?: unknown }): void;
};

const apiMocks = vi.hoisted(() => ({
  fetchLogsTail: vi.fn(),
  streamLogEvents: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);
vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;
let streamParams: CapturedLogStreamParams | null = null;

function renderLogsPanel() {
  root = createRoot(container);
  root.render(
    createElement(
      DataFabricTestProvider,
      null,
      createElement(DeckIntlProvider, { locale: "en" }, createElement(LogsPanel)),
    ),
  );
}

async function flushLogsQuery() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
  });
}

describe("LogsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    streamParams = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchLogsTail.mockResolvedValue({
      cursor: 12,
      lines: [
        "2026-04-24T10:00:00Z [INFO] [gateway] boot line sessionKey=sess-main",
        {
          level: "error",
          message: "json line sessionKey=sess-build",
          source: "agent",
          timestamp: "2026-04-24T10:01:00Z",
        },
      ],
      reset: false,
    });
    apiMocks.streamLogEvents.mockImplementation(async (params: CapturedLogStreamParams) => {
      streamParams = params;
      params.onStatusChange("connecting");
      params.onStatusChange("connected");
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
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("loads the persisted logs tail cursor and connects to the log stream", async () => {
    window.localStorage.setItem("deckGoLogsCursor", "7");
    window.localStorage.setItem("deckGoLogsLastEventId", "evt-before");

    await act(async () => {
      renderLogsPanel();
    });
    await flushLogsQuery();

    expect(apiMocks.fetchLogsTail).toHaveBeenCalledWith({
      cursor: 7,
      limit: 200,
      maxBytes: 65536,
    });
    expect(apiMocks.streamLogEvents).toHaveBeenCalledTimes(1);
    expect(streamParams?.initialLastEventId).toBe("evt-before");
    expect(container.querySelector(".logs-panel")).not.toBeNull();
    expect(container.querySelectorAll(".logs-card").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector(".logs-filter-bar")).not.toBeNull();
    expect(container.querySelectorAll(".log-row:not(.log-row--header)").length).toBe(2);
    expect(container.querySelector(".details-pane")).not.toBeNull();
    expect(container.textContent).toContain("Tail ready");
    expect(container.textContent).toContain("Stream connected");
    expect(container.textContent).toContain("cursor 12");
    expect(container.textContent).toContain("2 of 2 loaded");
    expect(container.textContent).toContain("boot line");
    expect(container.textContent).toContain("json line");
    expect(window.localStorage.getItem("deckGoLogsCursor")).toBe("12");
  });

  it("filters parsed log lines by level, source, and session and prepares export text", async () => {
    await act(async () => {
      renderLogsPanel();
    });
    await flushLogsQuery();

    expect(container.textContent).toContain("boot line");
    expect(container.textContent).toContain("json line");

    const infoCheckbox = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.parentElement?.textContent?.includes("Info"),
    );
    const sourceSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Log source filter"]',
    );
    const sessionSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Log session filter"]',
    );
    expect(infoCheckbox).toBeTruthy();
    expect(sourceSelect).toBeTruthy();
    expect(sessionSelect).toBeTruthy();

    await act(async () => {
      fireEvent.click(infoCheckbox as HTMLInputElement);
      fireEvent.change(sourceSelect as HTMLSelectElement, { target: { value: "agent" } });
      fireEvent.change(sessionSelect as HTMLSelectElement, { target: { value: "sess-build" } });
    });

    expect(container.textContent).toContain("1 of 2 loaded");
    expect(container.textContent).toContain("json line");
    const renderedRows = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".log-row:not(.log-row--header)"),
    )
      .map((row) => row.textContent ?? "")
      .join("\n");
    expect(renderedRows).toContain("json line");
    expect(renderedRows).not.toContain("boot line");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Prepare export")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Prepared log export");
    expect(container.textContent).toContain("[ERROR] [agent] sessionKey=sess-build");
  });

  it("applies live log batches, persists stream cursors, and handles resets", async () => {
    await act(async () => {
      renderLogsPanel();
    });
    await flushLogsQuery();

    expect(streamParams).toBeTruthy();

    await act(async () => {
      streamParams?.onEvent({
        id: "evt-live",
        event: "log.batch",
        json: { cursor: 99, lines: ["live line"] },
      });
    });

    expect(window.localStorage.getItem("deckGoLogsLastEventId")).toBe("evt-live");
    expect(window.localStorage.getItem("deckGoLogsCursor")).toBe("99");
    expect(container.textContent).toContain("cursor 99");
    expect(container.textContent).toContain("boot line");
    expect(container.textContent).toContain("live line");
    expect(container.textContent).toContain("3 of 3 loaded");
    expect(container.textContent).toContain("log batch (1 lines, cursor 99)");
    expect(container.textContent).toContain("log.batch");

    await act(async () => {
      streamParams?.onEvent({ id: "evt-reset", event: "log.reset", json: {} });
    });

    expect(window.localStorage.getItem("deckGoLogsLastEventId")).toBe("evt-reset");
    expect(container.textContent).toContain("log reset");
    expect(container.textContent).toContain("No log lines yet.");
  });
});
