// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarkdownText } from "../MarkdownText";
import { MarkdownViewer } from "../shared-renderer/MarkdownViewer";

function collectMarkdownShape(container: HTMLElement) {
  return {
    headings: Array.from(container.querySelectorAll("h1,h2,h3,h4,h5,h6"), (node) => ({
      tag: node.tagName.toLowerCase(),
      text: node.textContent,
    })),
    quoteParagraphs: Array.from(
      container.querySelectorAll("blockquote p"),
      (node) => node.textContent,
    ),
    listItems: Array.from(container.querySelectorAll("li"), (node) => node.textContent),
    tableCells: Array.from(container.querySelectorAll("th,td"), (node) => node.textContent),
    codeBlocks: Array.from(container.querySelectorAll("pre code"), (node) => node.textContent),
  };
}

describe("MarkdownText", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

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

  it("renders richer markdown structure without leaking raw syntax", () => {
    const markdown = [
      "# Heading",
      "",
      "Paragraph with *emphasis*, **bold**, `inline code`, [safe](https://example.test/docs), and ![diagram](https://example.test/image.png).",
      "",
      "> quoted line",
      ">",
      "> second paragraph",
      "",
      "- top item",
      "  - nested item",
      "3. ordered item",
      "",
      "---",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| alpha | beta |",
      "",
      "```ts",
      "const value = 1;",
      "```",
      "",
      "[unsafe](javascript:alert(1))",
    ].join("\n");

    act(() => {
      root = createRoot(container);
      root.render(createElement(MarkdownText, { text: markdown, streaming: true }));
    });

    expect(container.querySelector('[data-markdown-mode="streaming"]')).toBeTruthy();
    expect(container.querySelector("h1")?.textContent).toBe("Heading");
    expect(container.querySelector("p em")?.textContent).toBe("emphasis");
    expect(container.querySelector("p strong")?.textContent).toBe("bold");
    expect(container.querySelector("p code")?.textContent).toBe("inline code");
    expect(
      container.querySelector<HTMLAnchorElement>('a[href="https://example.test/docs"]')
        ?.textContent,
    ).toBe("safe");
    expect(
      container.querySelector<HTMLImageElement>('img[src="https://example.test/image.png"]')?.alt,
    ).toBe("diagram");
    expect(container.querySelectorAll("blockquote p")).toHaveLength(2);
    expect(container.querySelector("ul > li > ul > li")?.textContent).toBe("nested item");
    expect(container.querySelector("ol > li")?.textContent).toBe("ordered item");
    expect(container.querySelector("ol")?.getAttribute("start")).toBe("3");
    expect(container.querySelector("hr")).toBeTruthy();
    expect(container.querySelectorAll("table thead th")).toHaveLength(2);
    expect(container.querySelector("table tbody td")?.textContent).toBe("alpha");
    expect(container.querySelector('pre[data-language="ts"] code')?.textContent).toBe(
      "const value = 1;",
    );
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(container.textContent).not.toContain("**bold**");
    expect(container.textContent).not.toContain("```");
    expect(container.textContent).not.toContain("| Name | Value |");
  });

  it("keeps streaming markdown structurally equivalent to the final static render", () => {
    const partialMarkdown = [
      "## Streaming result",
      "",
      "> Old Deck keeps quote chrome while tokens arrive.",
      "",
      "```ts",
      "const pending = true;",
    ].join("\n");
    const finalMarkdown = [
      "## Streaming result",
      "",
      "> Old Deck keeps quote chrome while tokens arrive.",
      "",
      "- streamed item",
      "  - nested streamed item",
      "",
      "| State | Result |",
      "| --- | --- |",
      "| streaming | complete |",
      "",
      "```ts",
      "const pending = false;",
      "```",
    ].join("\n");

    act(() => {
      root = createRoot(container);
      root.render(createElement(MarkdownText, { text: partialMarkdown, streaming: true }));
    });

    expect(container.querySelector('[data-markdown-mode="streaming"]')).toBeTruthy();
    expect(container.querySelector("blockquote p")?.textContent).toBe(
      "Old Deck keeps quote chrome while tokens arrive.",
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector("pre code")?.textContent).toBe("const pending = true;");
    expect(container.textContent).not.toContain("```");

    act(() => {
      root?.render(createElement(MarkdownText, { text: finalMarkdown, streaming: true }));
    });

    const streamingShape = collectMarkdownShape(container);
    expect(streamingShape).toEqual({
      headings: [{ tag: "h2", text: "Streaming result" }],
      quoteParagraphs: ["Old Deck keeps quote chrome while tokens arrive."],
      listItems: ["streamed itemnested streamed item", "nested streamed item"],
      tableCells: ["State", "Result", "streaming", "complete"],
      codeBlocks: ["const pending = false;"],
    });
    expect(container.textContent).not.toContain("| State | Result |");
    expect(container.textContent).not.toContain("```");

    act(() => {
      root?.render(createElement(MarkdownText, { text: finalMarkdown, streaming: false }));
    });

    expect(container.querySelector('[data-markdown-mode="static"]')).toBeTruthy();
    expect(collectMarkdownShape(container)).toEqual(streamingShape);
  });

  it("keeps underscore-delimited plain text conservative while still rendering emphasis", () => {
    const markdown = "Keep foo_bar_baz plain but render *italic* text.";

    act(() => {
      root = createRoot(container);
      root.render(createElement(MarkdownText, { text: markdown }));
    });

    expect(container.querySelector("em")?.textContent).toBe("italic");
    expect(container.textContent).toContain("foo_bar_baz");
    expect(container.textContent).not.toContain("foobaz");
  });

  it("reuses the shared renderer in MarkdownViewer", () => {
    const markdown = "## Artifact\n\n- item\n\n| A | B |\n| --- | --- |\n| 1 | 2 |";

    act(() => {
      root = createRoot(container);
      root.render(createElement(MarkdownViewer, { content: markdown }));
    });

    expect(container.querySelector(".deck-ui-artifact-markdown")).toBeTruthy();
    expect(container.querySelector(".deck-ui-markdown")).toBeTruthy();
    expect(container.querySelector("h2")?.textContent).toBe("Artifact");
    expect(container.querySelector("ul > li")?.textContent).toBe("item");
    expect(container.querySelector("table tbody td")?.textContent).toBe("1");
  });
});
