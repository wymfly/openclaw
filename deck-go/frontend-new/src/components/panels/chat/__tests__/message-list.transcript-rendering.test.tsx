// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/stores/chat-types";
import { ArtifactPanel } from "../artifacts/ArtifactPanel";
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
          {
            type: "file",
            data: "ZmlsZQ==",
            mimeType: "text/plain",
            fileName: "report.txt",
            size: 2048,
          },
        ],
      },
      { type: "image", data: "abc", mimeType: "image/png", fileName: "diagram.png" },
      {
        type: "canvas",
        kind: "canvas",
        surface: "assistant_message",
        render: "url",
        url: "/__openclaw__/canvas/documents/demo/index.html",
        title: "Demo canvas",
        preferredHeight: 360,
      },
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
  let container: HTMLDivElement;
  let root: Root | null = null;

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

  it("renders known blocks without leaking raw JSON into the message bubble", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(TranscriptBlocks, { message: makeAssistantMessage(), isUser: false }),
      );
    });

    expect(container.textContent).toContain("trace");
    expect(container.textContent).toContain("bash");
    expect(container.textContent).toContain("nested-result");
    expect(container.textContent).toContain("report.txt");
    expect(container.textContent).toContain("2.0 KB");
    expect(container.textContent).toContain("toolResult");
    expect(container.querySelector('img[alt="diagram.png"]')).toBeTruthy();
    const canvas = container.querySelector<HTMLIFrameElement>('iframe[title="Demo canvas"]');
    expect(canvas?.getAttribute("src")).toBe("/api/canvas/documents/demo/index.html");
    expect(canvas?.getAttribute("height")).toBe("360");
    expect(container.textContent).toContain("Unsupported block: refusal");
    expect(container.textContent).toContain("final answer");
    expect(container.textContent).not.toContain('{"type":"text"');
  });

  it("keeps streaming tool calls collapsed and presents the tool name plus summary like the prototype", () => {
    const message: ChatMessage = {
      id: "msg-tool",
      role: "assistant",
      timestamp: 1234,
      streaming: true,
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "bash",
          input: { command: "pnpm test -- --runInBand" },
        },
      ],
    };

    act(() => {
      root = createRoot(container);
      root.render(createElement(TranscriptBlocks, { message, isUser: false, streaming: true }));
    });

    const toolButton = container.querySelector<HTMLButtonElement>(
      ".ds-tool-use-card .ds-block__head",
    );
    expect(toolButton).toBeTruthy();
    expect(toolButton?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("bash");
    expect(container.textContent).toContain("pnpm test -- --runInBand");
    expect(container.textContent).toContain("running");
    expect(container.textContent).not.toContain("toolCall");
    expect(container.textContent).not.toContain("command:");
  });

  it("opens and closes migrated image block previews", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(TranscriptBlocks, { message: makeAssistantMessage(), isUser: false }),
      );
    });

    expect(container.querySelector('[aria-label="Close image preview"]')).toBeNull();

    const imageButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="diagram.png"]',
    );
    expect(imageButton).toBeTruthy();

    act(() => {
      imageButton?.click();
    });

    const preview = container.querySelector<HTMLElement>('[aria-label="Close image preview"]');
    expect(preview).toBeTruthy();
    expect(container.querySelectorAll('img[alt="diagram.png"]')).toHaveLength(2);

    act(() => {
      preview?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(container.querySelector('[aria-label="Close image preview"]')).toBeNull();
  });

  it("renders assistant text markdown and marks the streaming tail block", () => {
    const message: ChatMessage = {
      id: "msg-2",
      role: "assistant",
      timestamp: 1234,
      content: [
        {
          type: "text",
          text: "Here is **bold** and `code`.\n\n```ts\nconst value = 1;\n```",
        },
      ],
    };

    act(() => {
      root = createRoot(container);
      root.render(createElement(TranscriptBlocks, { message, isUser: false, streaming: true }));
    });

    expect(container.querySelector('[data-markdown-mode="streaming"]')).toBeTruthy();
    expect(container.querySelector('[data-markdown-mode="streaming"] strong')?.textContent).toBe(
      "bold",
    );
    expect(container.querySelector("p code")?.textContent).toBe("code");
    expect(container.querySelector('pre[data-language="ts"] code')?.textContent).toBe(
      "const value = 1;",
    );
    expect(container.textContent).not.toContain("**bold**");
    expect(container.textContent).not.toContain("```");
  });

  it("renders OpenClaw status replies as structured status cards", () => {
    const message: ChatMessage = {
      id: "msg-openclaw-status",
      role: "assistant",
      timestamp: 1234,
      content: [
        {
          type: "text",
          text: [
            "OpenClaw 2026.4.14 (d7ab0bb)",
            "Model: cpa/gpt-5.4 · api-key (cpa:default)",
            "Tokens: 15k in / 192 out · Cost: $0.0000",
            "Context: 15k/256k (6%) · Compactions: 0",
            "Session: agent:main:dashboard:964960d7 • updated just now",
            "Runtime: direct · Think: high",
            "Queue: collect (depth 0)",
          ].join("\n"),
        },
      ],
    };

    act(() => {
      root = createRoot(container);
      root.render(createElement(TranscriptBlocks, { message, isUser: false }));
    });

    const card = container.querySelector(".deck-ui-openclaw-status-card");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("OpenClaw");
    expect(card?.textContent).toContain("2026.4.14");
    expect(card?.textContent).toContain("d7ab0bb");
    expect(card?.textContent).toContain("cpa/gpt-5.4");
    expect(card?.textContent).toContain("15k/256k (6%)");
    expect(card?.textContent).toContain("collect (depth 0)");
    expect(container.querySelector(".deck-ui-markdown")).toBeNull();
  });

  it("renders assistant headings, lists, and safe links as markdown structure", () => {
    const message: ChatMessage = {
      id: "msg-3",
      role: "assistant",
      timestamp: 1234,
      content: [
        {
          type: "text",
          text: "# Plan\n\n- one\n- two\n\nSee [docs](https://example.test/docs) and [unsafe](javascript:alert(1)).",
        },
      ],
    };

    act(() => {
      root = createRoot(container);
      root.render(createElement(TranscriptBlocks, { message, isUser: false }));
    });

    expect(container.querySelector("h1")?.textContent).toBe("Plan");
    expect(Array.from(container.querySelectorAll("li")).map((item) => item.textContent)).toEqual([
      "one",
      "two",
    ]);
    expect(
      container.querySelector<HTMLAnchorElement>('a[href="https://example.test/docs"]')
        ?.textContent,
    ).toBe("docs");
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(container.textContent).not.toContain("# Plan");
    expect(container.textContent).not.toContain("- one");
  });

  it("copies and downloads artifact content from the migrated artifact panel", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const createObjectURL = vi.fn(() => "blob:artifact");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(ArtifactPanel, {
          artifact: {
            content: '{"ok":true}',
            id: "artifact-1",
            language: "json",
            source: { fileName: "report.json" },
            title: "report.json",
          },
          onClose: vi.fn(),
        }),
      );
    });

    const copyButton = container.querySelector<HTMLButtonElement>('button[title="artifactCopy"]');
    const downloadButton = container.querySelector<HTMLButtonElement>(
      'button[title="artifactDownload"]',
    );

    await act(async () => {
      copyButton?.click();
      await Promise.resolve();
    });
    act(() => {
      downloadButton?.click();
    });

    expect(writeText).toHaveBeenCalledWith('{"ok":true}');
    expect(copyButton?.textContent).toBe("copied");
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:artifact");
  });

  it("renders CSV artifacts as tables with quoted fields", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(ArtifactPanel, {
          artifact: {
            content: 'name,notes\nalpha,"one,two"\nbeta,"quote ""inside"""',
            id: "artifact-2",
            language: "csv",
            title: "artifactTable",
          },
          onClose: vi.fn(),
        }),
      );
    });

    expect(Array.from(container.querySelectorAll("th")).map((cell) => cell.textContent)).toEqual([
      "name",
      "notes",
    ]);
    expect(Array.from(container.querySelectorAll("td")).map((cell) => cell.textContent)).toEqual([
      "alpha",
      "one,two",
      "beta",
      'quote "inside"',
    ]);
    expect(container.querySelector("pre")).toBeNull();
  });

  it("renders JSON artifacts as structured trees and invalid JSON as an error", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(ArtifactPanel, {
          artifact: {
            content: '{"name":"report","items":[1,true,null],"nested":{"ok":true}}',
            id: "artifact-3",
            language: "json",
            title: "artifactJson",
          },
          onClose: vi.fn(),
        }),
      );
    });

    expect(container.querySelector('[data-artifact-view="json"]')).toBeTruthy();
    expect(container.textContent).toContain("{3 keys}");
    expect(container.textContent).toContain('"name": "report"');
    expect(container.textContent).toContain("[3 items]");
    expect(container.textContent).toContain('"ok": true');
    expect(container.querySelector("pre")).toBeNull();

    act(() => {
      root?.render(
        createElement(ArtifactPanel, {
          artifact: {
            content: "{",
            id: "artifact-4",
            language: "json",
            title: "artifactJson",
          },
          onClose: vi.fn(),
        }),
      );
    });

    expect(container.querySelector('[data-artifact-view="json-error"]')?.textContent).toBe(
      "artifactJsonInvalid",
    );
  });

  it("renders Markdown artifacts through the migrated markdown seam", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(ArtifactPanel, {
          artifact: {
            content: "# Notes\n\n- item\n\nSee **bold** and [docs](https://example.test/docs).",
            id: "artifact-5",
            language: "markdown",
            title: "artifactMarkdown",
          },
          onClose: vi.fn(),
        }),
      );
    });

    expect(container.querySelector('[data-markdown-mode="static"]')).toBeTruthy();
    expect(container.querySelector("h1")?.textContent).toBe("Notes");
    expect(container.querySelector("li")?.textContent).toBe("item");
    expect(container.querySelector('[data-markdown-mode="static"] strong')?.textContent).toBe(
      "bold",
    );
    expect(
      container.querySelector<HTMLAnchorElement>('a[href="https://example.test/docs"]')
        ?.textContent,
    ).toBe("docs");
    expect(container.querySelector("pre")).toBeNull();
    expect(container.textContent).not.toContain("# Notes");
  });

  it("renders Mermaid artifacts through iframe srcdoc instead of raw text", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(ArtifactPanel, {
          artifact: {
            content: "graph TD\n  A[Start] --> B<End>",
            id: "artifact-6",
            language: "mermaid",
            title: "Diagram",
          },
          onClose: vi.fn(),
        }),
      );
    });

    const frame = container.querySelector<HTMLIFrameElement>("iframe");

    expect(frame?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame?.getAttribute("srcdoc")).toContain("mermaid.min.js");
    expect(frame?.getAttribute("srcdoc")).toContain('<pre class="mermaid">');
    expect(frame?.getAttribute("srcdoc")).toContain("B&lt;End&gt;");
    expect(container.querySelector(".deckgo-code")).toBeNull();
  });

  it("renders text artifacts through escaped iframe srcdoc", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(ArtifactPanel, {
          artifact: {
            content: "plain <unsafe> & visible",
            id: "artifact-7",
            language: "text",
            title: "Plain text",
          },
          onClose: vi.fn(),
        }),
      );
    });

    const frame = container.querySelector<HTMLIFrameElement>("iframe");

    expect(frame?.getAttribute("srcdoc")).toContain("white-space:pre-wrap");
    expect(frame?.getAttribute("srcdoc")).toContain("plain &lt;unsafe&gt; &amp; visible");
    expect(container.querySelector(".deckgo-code")).toBeNull();
  });

  it("toggles the artifact panel fullscreen state", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(ArtifactPanel, {
          artifact: {
            content: '{"ok":true}',
            id: "artifact-8",
            language: "json",
            title: "artifactJson",
          },
          onClose: vi.fn(),
        }),
      );
    });

    const panel = container.querySelector<HTMLElement>(".ds-artifact-panel");
    const fullscreenButton = container.querySelector<HTMLButtonElement>(
      'button[title="artifactFullscreen"]',
    );

    expect(panel?.dataset.fullscreen).toBe("false");
    expect(fullscreenButton?.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      fullscreenButton?.click();
    });

    expect(panel?.dataset.fullscreen).toBe("true");
    expect(panel?.classList.contains("ds-artifact-panel--fullscreen")).toBe(true);
    expect(fullscreenButton?.getAttribute("aria-pressed")).toBe("true");
  });
});
