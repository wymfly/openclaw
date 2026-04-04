// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/stores/chat-types";
import { TranscriptBlocks } from "../TranscriptBlocks";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = ((key: string) => key) as ((key: string) => string) & {
      has: (key: string) => boolean;
    };
    t.has = () => false;
    return t;
  },
}));

function makeAssistantMessage(): ChatMessage {
  return {
    id: "msg-1",
    role: "assistant",
    timestamp: 1234,
    content: [
      { type: "thinking", text: "trace" },
      { type: "tool_use", id: "tool-1", name: "bash", input: { command: "ls" } },
      {
        type: "tool_result",
        toolUseId: "tool-1",
        content: [
          { type: "text", text: "nested-result" },
          { type: "file", data: "ZmlsZQ==", mimeType: "text/plain", fileName: "report.txt" },
        ],
      },
      { type: "image", data: "abc", mimeType: "image/png", fileName: "diagram.png" },
      {
        type: "unknown",
        rawType: "refusal",
        summary: { type: "refusal", reason: "provider-skew" },
      },
      { type: "text", text: "final answer" },
    ],
  };
}

describe("TranscriptBlocks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders known blocks without leaking raw JSON into the message bubble", () => {
    render(<TranscriptBlocks message={makeAssistantMessage()} isUser={false} />);

    expect(screen.getByText("trace")).toBeTruthy();
    expect(screen.getByText("bash")).toBeTruthy();
    expect(screen.getByText("nested-result")).toBeTruthy();
    expect(screen.getByText("report.txt")).toBeTruthy();
    expect(screen.getByText("toolResult")).toBeTruthy();
    expect(screen.getByRole("img", { name: "diagram.png" })).toBeTruthy();
    expect(screen.getByText("Unsupported block: refusal")).toBeTruthy();
    expect(screen.getByText("final answer")).toBeTruthy();
    expect(screen.queryByText(/\{"type":"text"/)).toBeNull();
  });
});
