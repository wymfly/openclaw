// @vitest-environment jsdom
import { fireEvent } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { THREAD_FILTER_DEBOUNCE_MS } from "./thread-utils";
import { ThreadsPanel } from "./ThreadsPanel";

const apiMocks = vi.hoisted(() => ({
  fetchThreads: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToAgent: vi.fn(),
  navigateToSession: vi.fn(),
  ui: {
    setActivePanel: vi.fn(),
  },
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
let clipboardWriteText: ReturnType<typeof vi.fn>;

const baseTime = Date.UTC(2026, 3, 24, 8, 0, 0);

function renderThreadsPanel() {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale: "en" }, createElement(ThreadsPanel)));
}

function threadEntries() {
  return [
    {
      threadId: "thread-main",
      channelId: "discord",
      agentId: "main",
      targetSessionKey: "agent:main:web-main",
      targetKind: "session",
      boundAt: baseTime - 30_000,
      lastActivityAt: baseTime - 10_000,
      accountId: "acct-main",
      boundBy: "operator",
      label: "Main support thread",
    },
    {
      threadId: "thread-builder",
      channelId: "telegram",
      agentId: "builder",
      targetSessionKey: "agent:builder:web-build",
      targetKind: "session",
      boundAt: baseTime - 60_000,
      lastActivityAt: baseTime - 20_000,
      accountId: "acct-builder",
      boundBy: "system",
      label: "Builder escalation",
    },
  ];
}

describe("ThreadsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchThreads.mockResolvedValue({ threads: [...threadEntries()].toReversed() });
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

  it("loads, sorts, and selects active threads from the contract-backed API", async () => {
    await act(async () => {
      renderThreadsPanel();
    });

    expect(apiMocks.fetchThreads).toHaveBeenCalledWith({
      agentId: "",
      channel: "",
      status: "active",
    });
    expect(container.querySelector(".threads-panel")).not.toBeNull();
    expect(container.querySelectorAll(".threads-panel__card")).toHaveLength(2);
    expect(container.querySelectorAll(".threads-panel__thread-row")).toHaveLength(2);
    expect(container.querySelector(".threads-panel__relationship")).not.toBeNull();
    expect(container.textContent).toContain("Threads ready");
    expect(container.textContent).toContain("2 results");
    expect(container.textContent).toContain("Main support thread");
    expect(container.textContent).toContain("Builder escalation");
    expect(container.textContent).toContain("thread-main");
    expect(container.textContent).toContain("agent:main:web-main");

    const threadRows = Array.from(container.querySelectorAll(".threads-panel__thread-row")).map(
      (button) => button.textContent ?? "",
    );
    expect(threadRows[0]).toContain("Main support thread");
    expect(threadRows[0]).toContain("last activity: 10s ago");
  });

  it("debounces agent/channel filters, applies status immediately, and preserves selection", async () => {
    await act(async () => {
      renderThreadsPanel();
    });

    const builderButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Builder escalation"),
    );
    expect(builderButton).toBeTruthy();

    await act(async () => {
      builderButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("thread-builder");

    const agentInput = container.querySelector<HTMLInputElement>('input[placeholder="agent id"]');
    const channelInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="channel id"]',
    );
    const statusSelect = container.querySelector<HTMLSelectElement>("select");
    expect(agentInput).toBeTruthy();
    expect(channelInput).toBeTruthy();
    expect(statusSelect).toBeTruthy();

    await act(async () => {
      fireEvent.change(agentInput as HTMLInputElement, { target: { value: "builder" } });
    });
    await act(async () => {
      fireEvent.change(channelInput as HTMLInputElement, { target: { value: "telegram" } });
    });
    expect(apiMocks.fetchThreads).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(THREAD_FILTER_DEBOUNCE_MS - 1);
    });
    expect(apiMocks.fetchThreads).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(apiMocks.fetchThreads).toHaveBeenLastCalledWith({
      agentId: "builder",
      channel: "telegram",
      status: "active",
    });

    await act(async () => {
      fireEvent.change(statusSelect as HTMLSelectElement, { target: { value: "all" } });
    });

    expect(apiMocks.fetchThreads).toHaveBeenLastCalledWith({
      agentId: "builder",
      channel: "telegram",
      status: "all",
    });
    expect(container.textContent).toContain("thread-builder");
  });

  it("renders relation details and exposes copy/navigation handoffs", async () => {
    await act(async () => {
      renderThreadsPanel();
    });

    expect(container.textContent).toContain("Selected relationship");
    expect(container.textContent).toContain(
      "Thread thread-main on discord routes session agent:main:web-main to agent main; bound by operator for account acct-main.",
    );

    const copyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Copy session key",
    );
    const openSessionButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Open session",
    );
    const openAgentButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Open agent",
    );
    expect(copyButton).toBeTruthy();
    expect(openSessionButton).toBeTruthy();
    expect(openAgentButton).toBeTruthy();

    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clipboardWriteText).toHaveBeenCalledWith("agent:main:web-main");
    expect(container.textContent).toContain("Copied session key agent:main:web-main");

    await act(async () => {
      openSessionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToSession).toHaveBeenCalledWith(deckUIMocks.ui, {
      sessionKey: "agent:main:web-main",
    });
    expect(container.textContent).toContain(
      "Opened Sessions panel; target session: agent:main:web-main",
    );

    await act(async () => {
      openAgentButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(deckUIMocks.ui, {
      agentId: "main",
    });
    expect(container.textContent).toContain("Opened Agents panel; target agent: main");
  });

  it("shows a visible session key when clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    await act(async () => {
      renderThreadsPanel();
    });

    const copyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Copy session key",
    );
    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Session key ready to copy: agent:main:web-main");
  });

  it("renders empty and error states without fabricating thread rows", async () => {
    apiMocks.fetchThreads.mockResolvedValueOnce({ threads: [] });

    await act(async () => {
      renderThreadsPanel();
    });

    expect(container.querySelectorAll(".threads-panel__thread-row")).toHaveLength(0);
    expect(container.textContent).toContain("No thread bindings found");
    expect(container.textContent).toContain("Pick a thread binding");

    root?.unmount();
    root = null;
    container.innerHTML = "";
    apiMocks.fetchThreads.mockRejectedValueOnce(new Error("gateway unavailable"));

    await act(async () => {
      renderThreadsPanel();
    });

    expect(container.textContent).toContain("gateway unavailable");
    expect(container.querySelectorAll(".threads-panel__thread-row")).toHaveLength(0);
  });
});
