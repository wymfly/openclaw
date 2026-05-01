import { describe, expect, it } from "vitest";
import type {
  DeckGoSessionMeta,
  DeckGoTranscriptMessage,
} from "../../../contracts/generated/ts/deck-api.generated";
import {
  buildSessionExportJson,
  buildSessionExportMarkdown,
  findTranscriptMatches,
  transcriptMessageToPlainText,
} from "./session-export";

const session: DeckGoSessionMeta = {
  key: "sess-main",
  agentId: "main",
  title: "Main Session",
  updatedAt: Date.UTC(2026, 3, 24, 10, 0, 0),
  status: "idle",
  model: "gpt-5.4",
  modelProvider: "openai",
};

const messages: DeckGoTranscriptMessage[] = [
  {
    id: "m1",
    role: "user",
    timestamp: Date.UTC(2026, 3, 24, 10, 1, 0),
    content: [{ type: "text", text: "Build the session export feature" }],
  },
  {
    id: "m2",
    role: "assistant",
    timestamp: Date.UTC(2026, 3, 24, 10, 2, 0),
    content: [
      { type: "tool_use", id: "tool-1", name: "read_file", input: { path: "README.md" } },
      { type: "tool_result", toolUseId: "tool-1", content: "export helper found" },
    ],
  },
];

describe("session export helpers", () => {
  it("converts transcript messages into searchable plain text", () => {
    expect(transcriptMessageToPlainText(messages[1])).toContain("read_file");
    expect(transcriptMessageToPlainText(messages[1])).toContain("export helper found");
    expect(findTranscriptMatches(messages, "session export")).toEqual([0]);
    expect(findTranscriptMatches(messages, "README")).toEqual([1]);
  });

  it("builds JSON and Markdown exports from current Deck session data", () => {
    expect(JSON.parse(buildSessionExportJson(session, messages))).toMatchObject({
      session: { key: "sess-main", model: "gpt-5.4" },
      messages: [{ id: "m1" }, { id: "m2" }],
    });

    const markdown = buildSessionExportMarkdown(session, messages);
    expect(markdown).toContain("# Session: Main Session");
    expect(markdown).toContain("- Agent: main");
    expect(markdown).toContain("Build the session export feature");
    expect(markdown).toContain("export helper found");
  });
});
