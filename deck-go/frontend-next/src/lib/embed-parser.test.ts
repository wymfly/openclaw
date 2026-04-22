import { describe, expect, it } from "vitest";
import { extractCanvasShortcodes } from "./embed-parser";

describe("extractCanvasShortcodes", () => {
  it("extracts self-closing embed with ref", () => {
    const input = 'Here is the result:\n[embed ref="cv_123" title="Status" height="320" /]\nDone.';
    const { text, previews } = extractCanvasShortcodes(input);
    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({
      type: "canvas",
      kind: "canvas",
      surface: "assistant_message",
      render: "url",
      viewId: "cv_123",
      title: "Status",
      preferredHeight: 320,
    });
    expect(previews[0].url).toContain("cv_123");
    expect(text).toBe("Here is the result:\n\nDone.");
  });

  it("extracts block-form embed", () => {
    const input = '[embed ref="cv_abc" title="Doc"]some body[/embed]';
    const { text, previews } = extractCanvasShortcodes(input);
    expect(previews).toHaveLength(1);
    expect(previews[0].viewId).toBe("cv_abc");
    expect(text).toBe("");
  });

  it("ignores embed inside code fence", () => {
    const input = '```\n[embed ref="cv_inside" /]\n```';
    const { text, previews } = extractCanvasShortcodes(input);
    expect(previews).toHaveLength(0);
    expect(text).toBe(input);
  });

  it("returns original text when no embed present", () => {
    const input = "Hello world, no embeds here.";
    const { text, previews } = extractCanvasShortcodes(input);
    expect(previews).toHaveLength(0);
    expect(text).toBe(input);
  });

  it("handles malformed embed (no closing)", () => {
    const input = "Text before [embed ref=broken and after";
    const { text, previews } = extractCanvasShortcodes(input);
    expect(previews).toHaveLength(0);
    expect(text).toBe(input);
  });

  it("extracts multiple embeds from one message", () => {
    const input = 'First [embed ref="a" title="A" /] middle [embed ref="b" title="B" /] last';
    const { text, previews } = extractCanvasShortcodes(input);
    expect(previews).toHaveLength(2);
    expect(previews[0].viewId).toBe("a");
    expect(previews[1].viewId).toBe("b");
    expect(text).toContain("First");
    expect(text).toContain("middle");
    expect(text).toContain("last");
  });

  it("extracts external URL embed", () => {
    const input = '[embed url="https://example.com/widget" title="Widget" height="400" /]';
    const { text: stripped, previews } = extractCanvasShortcodes(input);
    expect(stripped).toBe("");
    expect(previews).toHaveLength(1);
    expect(previews[0].url).toBe("https://example.com/widget");
    expect(previews[0].title).toBe("Widget");
    expect(previews[0].preferredHeight).toBe(400);
    expect(previews[0].viewId).toBeUndefined();
  });

  it("handles empty/undefined input", () => {
    expect(extractCanvasShortcodes(undefined).previews).toHaveLength(0);
    expect(extractCanvasShortcodes("").previews).toHaveLength(0);
    expect(extractCanvasShortcodes("   ").previews).toHaveLength(0);
  });
});
