// @vitest-environment jsdom
import { NextIntlClientProvider } from "next-intl";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "@/stores/chat";
import { ToolProgressBar } from "../ToolProgressBar";

const messages = {
  chat: {
    tools: "Tools",
    toolsCompleted: "Tools completed",
    toolsRunning: "{count} tools running",
  },
};

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(NextIntlClientProvider, { locale: "en", messages }, children);
}

function resetChatStore() {
  useChatStore.setState({
    sessions: new Map(),
    sessionMetas: [],
    sessionMeta: [],
    sessionPreviewOverlays: {},
    activeSessionKey: null,
    activeAgentId: "main",
    sseStatus: "disconnected",
    canvasCommands: [],
  });
}

describe("ToolProgressBar", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    resetChatStore();
    container = document.createElement("div");
    document.body.appendChild(container);
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
    resetChatStore();
  });

  it("keeps completed tools briefly, then hides them while running tools stay visible", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    store.setActiveSession("sess-1");
    store.updateToolProgress("sess-1", "tool-running", {
      toolUseId: "tool-running",
      name: "bash",
      status: "running",
      startedAt: 9_000,
    });
    store.updateToolProgress("sess-1", "tool-completed", {
      toolUseId: "tool-completed",
      name: "write_file",
      status: "completed",
      startedAt: 8_000,
      completedAt: 9_500,
    });

    act(() => {
      root = createRoot(container);
      root.render(createElement(Wrapper, null, createElement(ToolProgressBar)));
    });

    expect(container.textContent).toContain("bash");
    expect(container.textContent).toContain("write_file");
    expect(container.textContent).toContain("1 tools running");
    expect(container.textContent).toContain("1s");

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(container.textContent).toContain("bash");
    expect(container.textContent).not.toContain("write_file");
    expect(container.textContent).toContain("4s");
  });

  it("resets hidden completed tools when the active session changes", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    store.setActiveSession("sess-1");
    store.updateToolProgress("sess-1", "shared-tool", {
      toolUseId: "shared-tool",
      name: "write_file",
      status: "completed",
      startedAt: 8_000,
      completedAt: 9_500,
    });

    act(() => {
      root = createRoot(container);
      root.render(createElement(Wrapper, null, createElement(ToolProgressBar)));
    });

    expect(container.textContent).toContain("write_file");

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(container.textContent).not.toContain("write_file");

    act(() => {
      store.ensureSession("sess-2");
      store.setActiveSession("sess-2");
      store.updateToolProgress("sess-2", "shared-tool", {
        toolUseId: "shared-tool",
        name: "read_file",
        status: "completed",
        startedAt: 12_000,
        completedAt: 12_500,
      });
    });

    expect(container.textContent).toContain("read_file");
    expect(container.textContent).toContain("Tools completed");
  });
});
