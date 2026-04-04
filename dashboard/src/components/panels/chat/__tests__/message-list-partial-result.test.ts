// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
let useChatStore: typeof import("@/stores/chat").useChatStore;
let createEmptySessionState: typeof import("@/stores/chat-types").createEmptySessionState;

beforeEach(async () => {
  vi.resetModules();
  ({ MessageList } = await import("../MessageList"));
  ({ useChatStore } = await import("@/stores/chat"));
  ({ createEmptySessionState } = await import("@/stores/chat-types"));
});

afterEach(() => {
  cleanup();
});

function seedSession(isStreaming: boolean) {
  const sessionKey = "sess-1";
  const session = {
    ...createEmptySessionState(),
    isStreaming,
    messages: [
      {
        id: "msg-1",
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "Partial answer" }],
        timestamp: Date.now(),
        streaming: true,
      },
    ],
  };
  const metas = [{ key: sessionKey, agentId: "main", updatedAt: Date.now() }];
  useChatStore.setState({
    activeSessionKey: sessionKey,
    sessions: new Map([[sessionKey, session]]),
    sessionMetas: metas,
    sessionMeta: metas,
  });
}

describe("MessageList partial result indicator", () => {
  it("shows a partial result indicator when the message is still marked streaming after the session stops", () => {
    seedSession(false);

    render(createElement(MessageList));

    expect(screen.getByText("Stream interrupted — partial result")).toBeTruthy();
  });

  it("does not show the indicator while the session is still streaming", () => {
    seedSession(true);

    render(createElement(MessageList));

    expect(screen.queryByText("Stream interrupted — partial result")).toBeNull();
  });
});
