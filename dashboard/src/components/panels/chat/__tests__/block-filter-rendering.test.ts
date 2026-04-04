import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock stores
vi.mock("@/stores/chat", () => {
  const store = {
    activeSessionKey: "s1",
    sessions: new Map([
      [
        "s1",
        {
          messages: new Map(),
          isStreaming: false,
          status: "idle",
          streamingRunId: null,
          activeApproval: null,
          a2uiState: null,
          lastAccessedAt: Date.now(),
          runMetadata: {},
        },
      ],
    ]),
    sessionMetas: [],
  };
  return {
    useChatStore: Object.assign((selector: (s: typeof store) => unknown) => selector(store), {
      getState: () => store,
      subscribe: vi.fn(() => vi.fn()),
      setState: vi.fn(),
      destroy: vi.fn(),
    }),
  };
});

const mockMessages = [
  {
    id: "msg-1",
    role: "assistant" as const,
    content: [
      { type: "tool_use" as const, id: "tu-1", name: "read_file", input: { path: "a.ts" } },
      {
        type: "tool_result" as const,
        toolUseId: "tu-1",
        content: "file content here",
        isError: false,
      },
      { type: "text" as const, text: "Done reading." },
    ],
    timestamp: Date.now(),
    streaming: false,
  },
];

vi.mock("@/stores/chat-hooks", () => ({
  useSessionMessages: vi.fn(() => mockMessages),
  useSessionStreaming: vi.fn(() => ({ isStreaming: false })),
}));

// Minimal messages for next-intl
const messages = {
  chat: {
    noMessages: "No messages",
    thinking: "Thinking...",
    partialResult: "Partial result",
    toolCall: "Tool call",
    copyJson: "Copy JSON",
    copied: "Copied",
    toolResult: "Tool result",
    toolError: "Tool error",
    showRaw: "Show raw",
    showFormatted: "Show formatted",
    binaryFile: "Binary file",
  },
};

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(NextIntlClientProvider, { locale: "en", messages, children });
}

describe("showToolResult block filter", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders ToolResultCard by default (showToolResult=true)", async () => {
    const { MessageList } = await import("../MessageList");
    render(
      createElement(
        Wrapper,
        null,
        createElement(MessageList, {
          blockPreferences: { showThinking: true, showToolUse: true, showToolResult: true },
        }),
      ),
    );
    // Tool use card should be visible
    expect(screen.getByText("read_file")).toBeDefined();
    // Tool result content should be visible
    expect(screen.getByText(/file content here/)).toBeDefined();
  });

  it("hides ToolResultCard when showToolResult=false", async () => {
    const { MessageList } = await import("../MessageList");
    render(
      createElement(
        Wrapper,
        null,
        createElement(MessageList, {
          blockPreferences: { showThinking: true, showToolUse: true, showToolResult: false },
        }),
      ),
    );
    // Tool use card should still be visible
    expect(screen.getByText("read_file")).toBeDefined();
    // Tool result content should NOT be visible
    expect(screen.queryByText(/file content here/)).toBeNull();
  });
});
