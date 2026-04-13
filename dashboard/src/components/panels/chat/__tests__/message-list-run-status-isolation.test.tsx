// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  },
};

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(NextIntlClientProvider, { locale: "en", messages, children });
}

let MessageList: typeof import("../MessageList").MessageList;
let useChatStore: typeof import("@/stores/chat").useChatStore;
let createEmptySessionState: typeof import("@/stores/chat-types").createEmptySessionState;

beforeEach(async () => {
  vi.resetModules();
  ({ MessageList } = await import("../MessageList"));
  ({ useChatStore } = await import("@/stores/chat"));
  ({ createEmptySessionState } = await import("@/stores/chat-types"));

  const sessionKey = "sess-1";
  const session = {
    ...createEmptySessionState(),
    isStreaming: true,
    status: "running" as const,
    messages: [
      {
        id: "old-run",
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "Older reply" }],
        timestamp: Date.now() - 1000,
        streaming: false,
      },
      {
        id: "new-run",
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "Streaming reply" }],
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
  };
  const metas = [
    {
      key: sessionKey,
      agentId: "main",
      updatedAt: Date.now(),
      totalTokens: 999,
      estimatedCostUsd: 1.23,
    },
  ];
  useChatStore.setState({
    activeSessionKey: sessionKey,
    sessions: new Map([[sessionKey, session]]),
    sessionMetas: metas,
    sessionMeta: metas,
  });
});

describe("MessageList run status isolation", () => {
  it("does not leak current session totals into older finalized assistant messages", () => {
    render(createElement(Wrapper, null, createElement(MessageList)));

    const sessionLabels = screen.getAllByText("Session");
    expect(sessionLabels).toHaveLength(1);
    expect(screen.getByText("Streaming reply")).toBeTruthy();
    expect(screen.getByText("Older reply")).toBeTruthy();
  });
});
