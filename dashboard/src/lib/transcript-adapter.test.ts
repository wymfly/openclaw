import { describe, expect, it } from "vitest";
import {
  mergeToolMessages,
  normalizeSessionMessagePayload,
  normalizeTranscriptContent,
  normalizeTranscriptMessages,
  normalizeTranscriptToolResultContent,
} from "./transcript-adapter";

describe("transcript-adapter", () => {
  it("normalizes canonical blocks, legacy aliases, and version-skew blocks", () => {
    const blocks = normalizeTranscriptContent([
      { type: "input_text", text: "hello" },
      { type: "reasoning", text: "trace" },
      { type: "toolCall", id: "tool-1", name: "bash", arguments: "{not-json" },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "abc" } },
      {
        type: "file",
        content: "ZmlsZQ==",
        mime_type: "text/plain",
        file_name: "note.txt",
      },
      { type: "refusal", reason: "provider-skew" },
    ]);

    expect(blocks).toEqual([
      { type: "text", text: "hello" },
      { type: "thinking", text: "trace" },
      { type: "tool_use", id: "tool-1", name: "bash", input: { raw: "{not-json" } },
      { type: "image", data: "abc", mimeType: "image/png" },
      { type: "file", data: "ZmlsZQ==", mimeType: "text/plain", fileName: "note.txt" },
      {
        type: "unknown",
        rawType: "refusal",
        summary: { type: "refusal", reason: "provider-skew" },
      },
    ]);
  });

  it("preserves structured tool_result content without stringifying it", () => {
    const result = normalizeTranscriptToolResultContent({
      content: [{ type: "output_text", text: "file.txt" }],
      details: { exitCode: 0 },
    });

    expect(result).toEqual([{ type: "text", text: "file.txt" }]);
  });

  it("normalizes session.message payloads with stable ids", () => {
    const message = normalizeSessionMessagePayload({
      sessionKey: "sess-1",
      messageId: "msg-1",
      messageSeq: 1,
      message: {
        role: "user",
        content: { type: "analysis", text: "hello" },
        timestamp: 1234,
      },
    });

    expect(message).toEqual({
      id: "msg-1",
      role: "user",
      content: [{ type: "thinking", text: "hello" }],
      timestamp: 1234,
    });
  });

  it("merges tool_use, tool_result, and trailing assistant text into one assistant message", () => {
    const messages = normalizeTranscriptMessages("agent:main:main", [
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

  it("keeps orphan tool blocks in a synthetic assistant message", () => {
    const messages = mergeToolMessages([
      {
        id: "tool-msg",
        role: "assistant",
        content: [{ type: "tool_use", id: "tool-1", name: "bash", input: { command: "ls" } }],
        timestamp: 10,
      },
    ]);

    expect(messages).toEqual([
      {
        id: "orphan-tools-10",
        role: "assistant",
        content: [{ type: "tool_use", id: "tool-1", name: "bash", input: { command: "ls" } }],
        timestamp: 10,
      },
    ]);
  });
});
