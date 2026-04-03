import { describe, expect, it } from "vitest";
import { normalizeHistoryContent, normalizeHistoryMessages } from "../history-normalize";

describe("history-normalize", () => {
  it("normalizes a single text content object without stringifying it", () => {
    const blocks = normalizeHistoryContent({
      type: "text",
      text: "hello from single block",
    });

    expect(blocks).toEqual([{ type: "text", text: "hello from single block" }]);
  });

  it("keeps hydrating when toolCall arguments are invalid JSON", () => {
    const blocks = normalizeHistoryContent([
      {
        type: "toolCall",
        id: "tool-1",
        name: "bash",
        arguments: "{not-json",
      },
    ]);

    expect(blocks).toEqual([
      {
        type: "tool_use",
        id: "tool-1",
        name: "bash",
        input: { raw: "{not-json" },
      },
    ]);
  });

  it("merges tool_use, tool_result, and trailing assistant text into one assistant message", () => {
    const messages = normalizeHistoryMessages("agent:main:main", [
      {
        role: "assistant",
        timestamp: 10,
        content: [{ type: "tool_use", id: "tool-1", name: "bash", input: { command: "ls" } }],
      },
      {
        role: "user",
        timestamp: 11,
        content: [{ type: "text", text: "file.txt" }],
      },
      {
        role: "assistant",
        timestamp: 12,
        content: [{ type: "text", text: "done" }],
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: "assistant",
      content: [
        { type: "tool_use", id: "tool-1", name: "bash", input: { command: "ls" } },
        { type: "tool_result", toolUseId: "tool-1", content: "file.txt", isError: false },
        { type: "text", text: "done" },
      ],
    });
  });
});
