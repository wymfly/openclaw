// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatState = {
  activeSessionKey: "sess-1",
  sessions: new Map<string, Record<string, unknown>>(),
  sessionMetas: [] as Array<Record<string, unknown>>,
};

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
    runId: null,
  })),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        noMessages: "No messages yet. Start a conversation!",
        partialResult: "Stream interrupted — partial result",
      }) as const
    )[key as "noMessages" | "partialResult"] ?? key,
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: ReactNode }) => children,
}));

let MessageList: typeof import("../MessageList").MessageList;
let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(async () => {
  vi.resetModules();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  ({ MessageList } = await import("../MessageList"));
  chatState.sessions = new Map();
  chatState.sessionMetas = [];
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
});

function seedSession(isStreaming: boolean) {
  chatState.sessions = new Map([
    [
      "sess-1",
      {
        isStreaming,
        status: isStreaming ? "running" : "idle",
        runMetadata: {},
        messages: [
          {
            id: "msg-1",
            role: "assistant" as const,
            content: [{ type: "text" as const, text: "Partial answer" }],
            timestamp: Date.now(),
            streaming: true,
          },
        ],
      },
    ],
  ]);
  chatState.sessionMetas = [{ key: "sess-1", agentId: "main", updatedAt: Date.now() }];
}

describe("MessageList partial result indicator", () => {
  it("shows a partial result indicator when the message is still marked streaming after the session stops", () => {
    seedSession(false);

    act(() => {
      root = createRoot(container);
      root.render(createElement(MessageList));
    });

    expect(container.textContent).toContain("Stream interrupted — partial result");
  });

  it("does not show the indicator while the session is still streaming", () => {
    seedSession(true);

    act(() => {
      root = createRoot(container);
      root.render(createElement(MessageList));
    });

    expect(container.textContent).not.toContain("Stream interrupted — partial result");
  });
});
