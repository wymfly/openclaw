import { NextIntlClientProvider } from "next-intl";
// @vitest-environment jsdom
import { act } from "react";
import { createElement, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const messages = {
  chat: {
    noMessages: "No messages",
    thinking: "Thinking...",
    partialResult: "Partial result",
    copy: "Copy",
    toolCall: "Tool call",
    copyJson: "Copy JSON",
    copied: "Copied",
    messageActions: "Message actions",
    retry: "Retry",
    thumbsUp: "Thumbs up",
    thumbsDown: "Thumbs down",
    toolResult: "Tool result",
    toolError: "Tool error",
    showRaw: "Show raw",
    showFormatted: "Show formatted",
    binaryFile: "Binary file",
    bashCommand: "Command",
    bashExitCode: "Exit code",
    bashStdout: "STDOUT",
    bashStderr: "STDERR",
    download: "Download",
    virtualLines: "Lines {start}-{end} of {total}",
    virtualExpand: "Expand all",
    virtualCollapse: "Collapse",
  },
};

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(NextIntlClientProvider, { locale: "en", messages, children });
}

describe("showToolResult block filter", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("renders ToolResultCard by default (showToolResult=true)", async () => {
    const { MessageList } = await import("../MessageList");
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(MessageList, {
            blockPreferences: { showThinking: true, showToolUse: true, showToolResult: true },
          }),
        ),
      );
    });

    expect(container.textContent).toContain("read_file");
    expect(container.textContent).toContain("file content here");
  });

  it("hides ToolResultCard when showToolResult=false", async () => {
    const { MessageList } = await import("../MessageList");
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(MessageList, {
            blockPreferences: { showThinking: true, showToolUse: true, showToolResult: false },
          }),
        ),
      );
    });

    expect(container.textContent).toContain("read_file");
    expect(container.textContent).not.toContain("file content here");
  });

  it("routes bash tool results into structured stdout and stderr sections", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content: "$ npm test\npassed\nstderr:\nwarned\nexit code: 0",
            toolName: "bash",
            toolInput: { command: "npm test" },
          }),
        ),
      );
    });

    expect(container.querySelector('[data-tool-result-view="bash"]')).toBeTruthy();
    expect(container.textContent).toContain("Command");
    expect(container.textContent).toContain("Exit code: 0");
    expect(container.textContent).toContain("STDOUT");
    expect(container.textContent).toContain("passed");
    expect(container.textContent).toContain("STDERR");
    expect(container.textContent).toContain("warned");
  });

  it("routes file read results through a language-tagged read view", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content: "export const value = 1;",
            toolName: "read_file",
            toolInput: { path: "src/value.ts" },
          }),
        ),
      );
    });

    const readView = container.querySelector('[data-tool-result-view="read"]');
    expect(readView).toBeTruthy();
    expect(readView?.getAttribute("data-language")).toBe("ts");
    expect(container.textContent).toContain("export const value");
  });

  it("routes image file read results through the media preview endpoint", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content: "image bytes",
            toolName: "read_file",
            toolInput: { path: "screenshots/home view.png" },
          }),
        ),
      );
    });

    const preview = container.querySelector('[data-file-preview="image"]');
    const image = container.querySelector<HTMLImageElement>('img[alt="home view.png"]');
    const download = container.querySelector<HTMLAnchorElement>('a[download="home view.png"]');
    expect(preview?.getAttribute("data-tool-result-view")).toBe("read");
    expect(image?.getAttribute("src")).toBe("/api/media?path=screenshots%2Fhome%20view.png");
    expect(download?.getAttribute("href")).toBe(
      "/api/media?path=screenshots%2Fhome%20view.png&dl=1",
    );
    expect(container.textContent).not.toContain("image bytes");
  });

  it("limits binary-content fallback to file read results", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content: "raw\0payload",
            toolName: "read_file",
            toolInput: { path: "src/blob.bin" },
          }),
        ),
      );
    });

    expect(container.textContent).toContain("Binary file");

    act(() => {
      root?.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content: "raw\0payload",
            toolName: "custom_tool",
          }),
        ),
      );
    });

    expect(container.textContent).not.toContain("Binary file");
    expect(container.querySelector("pre")?.textContent).toContain("raw");
  });

  it("routes file write results through a diff-style added view", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content: "new line",
            toolName: "write_file",
            toolInput: { path: "src/value.ts" },
          }),
        ),
      );
    });

    expect(container.querySelector('[data-tool-result-view="diff"]')).toBeTruthy();
    expect(container.querySelector('[data-diff-line="added"]')?.textContent).toBe("+new line");
    expect(
      container.querySelector<HTMLAnchorElement>('a[download="value.ts"]')?.getAttribute("href"),
    ).toBe("/api/media?path=src%2Fvalue.ts&dl=1");
  });

  it("uses the binary placeholder for binary file write results", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content: "raw\0payload",
            toolName: "write_file",
            toolInput: { path: "src/blob.bin" },
          }),
        ),
      );
    });

    expect(container.querySelector('[data-tool-result-view="diff"]')).toBeTruthy();
    expect(container.textContent).toContain("Binary file");
    expect(container.querySelector("[data-diff-line]")).toBeNull();
  });

  it("restores the legacy details chrome and keeps view-tab state per card", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(
            "div",
            null,
            createElement(ToolResultCard, {
              content: "export const first = 1;",
              toolName: "read_file",
              toolInput: { path: "src/first.ts" },
            }),
            createElement(ToolResultCard, {
              content: "export const second = 2;",
              toolName: "read_file",
              toolInput: { path: "src/second.ts" },
            }),
          ),
        ),
      );
    });

    const details = Array.from(container.querySelectorAll<HTMLDetailsElement>("details")).filter(
      (element) => element.classList.contains("deck-ui-tool-result-card"),
    );
    expect(details).toHaveLength(2);
    expect(details[0]?.open).toBe(false);
    expect(details[1]?.open).toBe(false);

    // SegmentedControl: each card has 4 tabs (raw/bash/read/diff). The raw tab
    // is always enabled and labelled "Show raw" via t() mock; for read_file the
    // detected view is "read" so that tab is selected by default.
    function rawTabs(): HTMLButtonElement[] {
      return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).filter(
        (button) => button.textContent === "Show raw",
      );
    }
    const initialRawTabs = rawTabs();
    expect(initialRawTabs).toHaveLength(2);
    expect(details[0]?.querySelector("summary")?.contains(initialRawTabs[0] ?? null)).toBe(true);
    expect(initialRawTabs[0]?.getAttribute("aria-selected")).toBe("false");
    expect(initialRawTabs[1]?.getAttribute("aria-selected")).toBe("false");

    act(() => {
      initialRawTabs[0]?.click();
    });

    // Card 1 switched to raw; card 2 stays on detected (read) view.
    const updatedRawTabs = rawTabs();
    expect(updatedRawTabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(updatedRawTabs[1]?.getAttribute("aria-selected")).toBe("false");
    // Per-card details still closed (clicking a tab inside summary does not toggle the details).
    expect(details[0]?.open).toBe(false);
    expect(details[1]?.open).toBe(false);
  });

  it("opens error tool result cards by default", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content: "boom",
            toolName: "custom_tool",
            isError: true,
          }),
        ),
      );
    });

    const details = container.querySelector<HTMLDetailsElement>(
      "details.deck-ui-tool-result-card.is-error",
    );
    expect(details).toBeTruthy();
    expect(details?.open).toBe(true);
    expect(details?.querySelector("summary")?.textContent).toContain("Tool error");
  });

  it("keeps an error card collapsed after rerender once the user closes it", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");

    const renderCard = () =>
      createElement(
        Wrapper,
        null,
        createElement(ToolResultCard, {
          content: "boom",
          toolName: "custom_tool",
          isError: true,
        }),
      );

    act(() => {
      root = createRoot(container);
      root.render(renderCard());
    });

    const details = container.querySelector<HTMLDetailsElement>(
      "details.deck-ui-tool-result-card.is-error",
    );
    expect(details?.open).toBe(true);

    act(() => {
      if (!details) {
        return;
      }
      flushSync(() => {
        details.open = false;
        details.dispatchEvent(new Event("toggle", { bubbles: false }));
      });
      root?.render(renderCard());
    });

    const rerenderedDetails = container.querySelector<HTMLDetailsElement>(
      "details.deck-ui-tool-result-card.is-error",
    );
    expect(rerenderedDetails?.open).toBe(false);
  });

  it("opens a card when the same instance transitions into an error result", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");

    const renderCard = (isError: boolean) =>
      createElement(
        Wrapper,
        null,
        createElement(ToolResultCard, {
          content: "transition",
          toolName: "custom_tool",
          isError,
        }),
      );

    act(() => {
      root = createRoot(container);
      root.render(renderCard(false));
    });

    const initialDetails = container.querySelector<HTMLDetailsElement>(
      "details.deck-ui-tool-result-card",
    );
    expect(initialDetails?.open).toBe(false);

    act(() => {
      root?.render(renderCard(true));
    });

    const errorDetails = container.querySelector<HTMLDetailsElement>(
      "details.deck-ui-tool-result-card.is-error",
    );
    expect(errorDetails?.open).toBe(true);
  });

  it("does not block the native keyboard activation path for the raw view tab", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content: "export const value = 1;",
            toolName: "read_file",
            toolInput: { path: "src/value.ts" },
          }),
        ),
      );
    });

    const rawTab = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (button) => button.textContent === "Show raw",
    );
    expect(rawTab).toBeTruthy();
    expect(rawTab?.getAttribute("aria-selected")).toBe("false");

    // SegmentedControl tabs are native <button> elements — Space/Enter map to
    // click. Verify we don't preventDefault on the keyboard path that would
    // suppress activation.
    const keyboardEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: " ",
    });
    rawTab?.dispatchEvent(keyboardEvent);
    expect(keyboardEvent.defaultPrevented).toBe(false);

    act(() => {
      rawTab?.click();
    });

    // After click the raw tab becomes the selected segment.
    expect(rawTab?.getAttribute("aria-selected")).toBe("true");
  });

  it("collapses long raw tool results until explicitly expanded", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");
    const content = Array.from({ length: 205 }, (_, index) => `line-${index + 1}`).join("\n");

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content,
            toolName: "custom_tool",
          }),
        ),
      );
    });

    expect(container.querySelector('[data-tool-result-view="virtual"]')).toBeTruthy();
    expect(container.textContent).toContain("Lines 1-200 of 205");
    expect(container.textContent).toContain("line-200");
    expect(container.textContent).not.toContain("line-205");

    const expandButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Expand all",
    );
    act(() => {
      expandButton?.click();
    });

    expect(container.textContent).toContain("Lines 1-205 of 205");
    expect(container.textContent).toContain("line-205");
    expect(container.textContent).toContain("Collapse");
  });

  it("toggles large structured tool results back to raw JSON", async () => {
    const { ToolResultCard } = await import("../blocks/ToolResultCard");
    const content = Array.from({ length: 60 }, (_, index) => ({
      type: "text" as const,
      text: `structured-line-${index + 1}`,
    }));

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          Wrapper,
          null,
          createElement(ToolResultCard, {
            content,
            toolName: "custom_tool",
          }),
        ),
      );
    });

    // Default activeView is "structured" for structured (non-string) content;
    // each child block renders via its typed renderer.
    expect(container.textContent).toContain("structured-line-60");

    // Click the raw tab to switch to JSON serialization.
    const rawTab = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (button) => button.textContent === "Show raw",
    );
    expect(rawTab).toBeTruthy();
    expect(rawTab?.getAttribute("aria-selected")).toBe("false");

    act(() => {
      rawTab?.click();
    });

    expect(rawTab?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain('"type": "text"');
    // Long content (>200 JSON lines) renders via virtual scroll.
    expect(container.querySelector('[data-tool-result-view="virtual"]')).toBeTruthy();
  });
});
