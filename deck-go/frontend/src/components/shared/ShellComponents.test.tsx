import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DeckGoTranscriptMessage } from "../../../../contracts/generated/ts/deck-api.generated";
import { TranscriptList } from "./ShellComponents";

afterEach(() => {
  cleanup();
});

describe("TranscriptList", () => {
  it("renders text, tool use, and tool result blocks with readable labels", () => {
    const messages: DeckGoTranscriptMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        content: [
          { type: "text", text: "The command completed." },
          {
            type: "tool_use",
            id: "tool-1",
            name: "exec",
            input: { command: "pwd", workdir: "/tmp/workspace" },
          },
          {
            type: "tool_result",
            toolUseId: "tool-1",
            content: "/tmp/workspace",
            isError: false,
          },
        ],
        timestamp: 1,
      },
    ];

    render(<TranscriptList messages={messages} />);

    expect(screen.getByText("Text")).toBeTruthy();
    expect(screen.getByText("Tool use")).toBeTruthy();
    expect(screen.getByText("Tool result")).toBeTruthy();
    expect(screen.getByText("exec")).toBeTruthy();
    expect(screen.getByText("pwd")).toBeTruthy();
    expect(screen.getByText("/tmp/workspace")).toBeTruthy();
  });
});
