// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptBlocks } from "../TranscriptBlocks";

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return actual;
});

const messages = {
  chat: {
    toolCall: "Tool call",
    toolResult: "Tool result",
    toolError: "Tool error",
    copyJson: "Copy JSON",
    copied: "Copied",
    binaryFile: "Binary file",
  },
};

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(NextIntlClientProvider, { locale: "en", messages, children });
}

describe("chat hardening transcript order", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders later text after tool blocks instead of merging it back into the first text segment", () => {
    const message = {
      id: "run-1",
      role: "assistant" as const,
      timestamp: Date.now(),
      content: [
        { type: "text" as const, text: "First reply." },
        { type: "tool_use" as const, id: "tool-1", name: "bash", input: { command: "ls" } },
        { type: "tool_result" as const, toolUseId: "tool-1", content: "file.txt" },
        { type: "text" as const, text: "Second reply after tools." },
      ],
    };

    const { container } = render(
      createElement(Wrapper, null, createElement(TranscriptBlocks, { message, isUser: false })),
    );

    const text = container.textContent ?? "";
    expect(text.indexOf("First reply.")).toBeLessThan(text.indexOf("Tool call"));
    expect(text.indexOf("Tool call")).toBeLessThan(text.indexOf("Second reply after tools."));
    expect(screen.getByText("Second reply after tools.")).toBeTruthy();
  });
});
