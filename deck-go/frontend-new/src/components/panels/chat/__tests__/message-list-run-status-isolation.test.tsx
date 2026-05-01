import { NextIntlClientProvider } from "next-intl";
// @vitest-environment jsdom
import { act } from "react";
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatState = {
  activeSessionKey: "sess-1",
  sessions: new Map<string, Record<string, unknown>>(),
  sessionMetas: [] as Array<Record<string, unknown>>,
};

const runStatusCalls: Array<Record<string, unknown>> = [];

vi.mock("@/stores/chat", () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof chatState) => unknown) => selector(chatState),
    {
      getState: () => chatState,
      setState: (patch: Partial<typeof chatState>) => Object.assign(chatState, patch),
      subscribe: vi.fn(() => vi.fn()),
      destroy: vi.fn(),
    },
  ),
}));

vi.mock("@/stores/chat-hooks", () => ({
  useSessionMessages: vi.fn(() => chatState.sessions.get("sess-1")?.messages ?? []),
  useSessionStreaming: vi.fn(() => ({
    isStreaming: Boolean(chatState.sessions.get("sess-1")?.isStreaming),
    runId: chatState.sessions.get("sess-1")?.streamingRunId ?? null,
  })),
}));

vi.mock("../RunStatusBar", () => ({
  RunStatusBar: (props: Record<string, unknown>) => {
    runStatusCalls.push(props);
    return createElement("div", null, "run-status");
  },
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const messages = {
  chat: {
    noMessages: "No messages",
    partialResult: "Partial result",
    thinking: "Thinking",
    runTokensIn: "In",
    runTokensOut: "Out",
    runTokensCache: "Cache",
    runStreaming: "Streaming",
    runDuration: "Duration",
    sessionTokens: "Session",
    status_running: "Running",
    status_done: "Done",
    copy: "Copy",
    copied: "Copied",
    messageActions: "Message actions",
  },
};

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(NextIntlClientProvider, { locale: "en", messages, children });
}

let MessageList: typeof import("../MessageList").MessageList;
let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(async () => {
  vi.resetModules();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  ({ MessageList } = await import("../MessageList"));
  runStatusCalls.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);

  chatState.sessions = new Map([
    [
      "sess-1",
      {
        isStreaming: true,
        status: "running",
        streamingRunId: "new-run",
        messages: [
          {
            id: "old-run",
            role: "assistant",
            content: [{ type: "text", text: "Older reply" }],
            timestamp: Date.now() - 1000,
            streaming: false,
          },
          {
            id: "new-run",
            role: "assistant",
            content: [{ type: "text", text: "Streaming reply" }],
            timestamp: Date.now(),
            streaming: true,
          },
        ],
        runMetadata: {
          "old-run": { runId: "old-run", model: "gpt-5.4", usage: { input: 10, output: 20 } },
          "new-run": {
            runId: "new-run",
            model: "gpt-5.4",
            usage: { input: 1, output: 2 },
            streaming: true,
          },
        },
      },
    ],
  ]);
  chatState.sessionMetas = [
    {
      key: "sess-1",
      agentId: "main",
      updatedAt: Date.now(),
      totalTokens: 999,
      estimatedCostUsd: 1.23,
    },
  ];
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container.remove();
});

describe("MessageList run status isolation", () => {
  it("does not leak current session totals into older finalized assistant messages", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(Wrapper, null, createElement(MessageList)));
    });

    expect(runStatusCalls).toHaveLength(2);
    expect(runStatusCalls[0]?.sessionTotalTokens).toBeUndefined();
    expect(runStatusCalls[1]?.sessionTotalTokens).toBe(999);
    expect(runStatusCalls[1]?.sessionCostUsd).toBe(1.23);
  });
});
