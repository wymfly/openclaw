import { NextIntlClientProvider } from "next-intl";
// @vitest-environment jsdom
import { act } from "react";
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ToolUseCard } from "../blocks/ToolUseCard";
import { MessageActions } from "../MessageActions";
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
    copy: "Copy",
    messageActions: "Message actions",
    retry: "Retry",
    thumbsDown: "Thumbs down",
    thumbsUp: "Thumbs up",
    paramKeys: "{count} keys",
    paramNoParams: "No parameters",
    paramShowFull: "Show full",
    paramShowLess: "Show less",
    binaryFile: "Binary file",
    download: "Download",
    thinking: "Thinking",
  },
};

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(NextIntlClientProvider, { locale: "en", messages, children });
}

let container: HTMLDivElement;
let root: Root | null = null;

describe("chat hardening transcript order", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(Wrapper, null, createElement(TranscriptBlocks, { message, isUser: false })),
      );
    });

    const text = container.textContent ?? "";
    expect(text.indexOf("First reply.")).toBeLessThan(text.indexOf("Tool call"));
    expect(text.indexOf("Tool call")).toBeLessThan(text.indexOf("Second reply after tools."));
    expect(text).toContain("Second reply after tools.");
  });

  it("keeps message reaction buttons as local mutually exclusive toggles", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(Wrapper, null, createElement(MessageActions, { content: "hello" })),
      );
    });

    const thumbsUp = container.querySelector<HTMLButtonElement>('button[title="Thumbs up"]');
    const thumbsDown = container.querySelector<HTMLButtonElement>('button[title="Thumbs down"]');

    expect(thumbsUp).not.toBeNull();
    expect(thumbsDown).not.toBeNull();
    expect(thumbsUp?.getAttribute("aria-pressed")).toBe("false");
    expect(thumbsDown?.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      thumbsUp?.click();
    });

    expect(thumbsUp?.getAttribute("aria-pressed")).toBe("true");
    expect(thumbsDown?.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      thumbsDown?.click();
    });

    expect(thumbsUp?.getAttribute("aria-pressed")).toBe("false");
    expect(thumbsDown?.getAttribute("aria-pressed")).toBe("true");

    act(() => {
      thumbsDown?.click();
    });

    expect(thumbsUp?.getAttribute("aria-pressed")).toBe("false");
    expect(thumbsDown?.getAttribute("aria-pressed")).toBe("false");
  });

  it("copies tool input JSON from tool call cards", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const input = { command: "ls", timeoutMs: 1000 };

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolUseCard, {
            defaultOpen: true,
            input,
            name: "bash",
          }),
        ),
      );
    });

    const copyButton = container.querySelector<HTMLButtonElement>('button[title="Copy JSON"]');
    expect(copyButton).not.toBeNull();

    await act(async () => {
      copyButton?.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(JSON.stringify(input, null, 2));
    expect(copyButton?.textContent).toBe("Copied");
  });

  it("renders tool input parameters as structured expandable values", () => {
    const longValue = `${"a".repeat(500)}tail`;

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolUseCard, {
            defaultOpen: true,
            input: {
              command: longValue,
              count: 2,
              nested: { recursive: true },
            },
            name: "bash",
          }),
        ),
      );
    });

    expect(container.textContent).toContain("command:");
    expect(container.textContent).toContain("Tool call: bash (command, count, nested)");
    expect(container.textContent).toContain("count: 2");
    expect(container.textContent).toContain("1 keys");
    expect(container.textContent).not.toContain("tail");

    const expandButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Show full",
    );
    act(() => {
      expandButton?.click();
    });

    expect(container.textContent).toContain("tail");
    expect(container.textContent).toContain("Show less");
  });
});
