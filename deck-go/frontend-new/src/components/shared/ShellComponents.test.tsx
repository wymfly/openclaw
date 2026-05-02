import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DeckGoTranscriptMessage } from "../../../../contracts/generated/ts/deck-api.generated";
import { DeckIntlProvider } from "../../i18n/provider";
import { TranscriptList } from "./ShellComponents";

let container: HTMLDivElement;
let root: Root | null = null;

function renderTranscript(messages: DeckGoTranscriptMessage[], locale: "en" | "zh") {
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(DeckIntlProvider, { locale }, createElement(TranscriptList, { messages })),
    );
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
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

    renderTranscript(messages, "en");

    expect(container.textContent).toContain("Text");
    expect(container.textContent).toContain("Tool use");
    expect(container.textContent).toContain("Tool result");
    expect(container.textContent).toContain("exec");
    expect(container.textContent).toContain("pwd");
    expect(container.textContent).toContain("/tmp/workspace");
  });

  it("renders shared transcript copy through the active locale", () => {
    renderTranscript([], "zh");

    expect(container.textContent).toContain("暂无对话消息。");
  });
});
