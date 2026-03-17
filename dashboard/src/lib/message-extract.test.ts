import { describe, it, expect } from "vitest";
import { extractText, extractThinking, stripChannelEnvelope } from "./message-extract.js";

describe("extractText", () => {
  it("returns null for null/undefined input", () => {
    expect(extractText(null)).toBeNull();
    expect(extractText(undefined)).toBeNull();
  });

  it("extracts text from a simple string content message", () => {
    const msg = { role: "user", content: "Hello world" };
    expect(extractText(msg)).toBe("Hello world");
  });

  it("extracts text from array content with text parts", () => {
    const msg = {
      role: "user",
      content: [
        { type: "text", text: "First part" },
        { type: "text", text: "Second part" },
      ],
    };
    expect(extractText(msg)).toBe("First part\nSecond part");
  });

  it("falls back to .text property", () => {
    const msg = { role: "user", text: "Fallback text" };
    expect(extractText(msg)).toBe("Fallback text");
  });

  it("strips thinking tags from assistant messages", () => {
    const msg = {
      role: "assistant",
      content: "<thinking>internal reasoning</thinking>The actual answer.",
    };
    expect(extractText(msg)).toBe("The actual answer.");
  });

  it("strips thinking tags with whitespace variations", () => {
    const msg = {
      role: "assistant",
      content: "< thinking >reasoning here</ thinking >visible text",
    };
    expect(extractText(msg)).toBe("visible text");
  });

  it("handles nested/multiple thinking blocks in assistant messages", () => {
    const msg = {
      role: "assistant",
      content: "<thinking>block1</thinking>visible1<thinking>block2</thinking>visible2",
    };
    expect(extractText(msg)).toBe("visible1visible2");
  });

  it("strips channel envelope from user messages", () => {
    const msg = {
      role: "user",
      content: "[WhatsApp 2025-01-01 10:00] Hello from WhatsApp",
    };
    expect(extractText(msg)).toBe("Hello from WhatsApp");
  });

  it("does not strip non-envelope brackets from user messages", () => {
    const msg = {
      role: "user",
      content: "[not an envelope] Just normal text",
    };
    expect(extractText(msg)).toBe("[not an envelope] Just normal text");
  });

  it("returns plain text unchanged for user messages", () => {
    const msg = { role: "user", content: "Plain text message" };
    expect(extractText(msg)).toBe("Plain text message");
  });
});

describe("extractThinking", () => {
  it("returns null for null/undefined input", () => {
    expect(extractThinking(null)).toBeNull();
    expect(extractThinking(undefined)).toBeNull();
  });

  it("extracts thinking from content array with thinking type", () => {
    const msg = {
      role: "assistant",
      content: [
        { type: "thinking", text: "My internal reasoning" },
        { type: "text", text: "Visible output" },
      ],
    };
    expect(extractThinking(msg)).toBe("My internal reasoning");
  });

  it("extracts thinking from direct thinking property", () => {
    const msg = {
      role: "assistant",
      thinking: "Direct thinking content",
      content: "Some text",
    };
    expect(extractThinking(msg)).toBe("Direct thinking content");
  });

  it("extracts thinking from inline tags in text content", () => {
    const msg = {
      role: "assistant",
      content: "<thinking>Tag-based thinking</thinking>visible",
    };
    expect(extractThinking(msg)).toBe("Tag-based thinking");
  });

  it("returns null when no thinking content exists", () => {
    const msg = {
      role: "assistant",
      content: "Just a plain response with no thinking",
    };
    expect(extractThinking(msg)).toBeNull();
  });

  it("extracts thinking from analysis tags", () => {
    const msg = {
      role: "assistant",
      content: "<analysis>Analyzing the problem</analysis>Here is my answer.",
    };
    expect(extractThinking(msg)).toBe("Analyzing the problem");
  });

  it("extracts multiple thinking blocks", () => {
    const msg = {
      role: "assistant",
      content: [
        { type: "thinking", text: "First thought" },
        { type: "text", text: "Response" },
        { type: "thinking", text: "Second thought" },
      ],
    };
    expect(extractThinking(msg)).toBe("First thought\nSecond thought");
  });
});

describe("stripChannelEnvelope", () => {
  it("strips a WhatsApp envelope", () => {
    expect(stripChannelEnvelope("[WhatsApp 2025-01-15 14:30] Hello there")).toBe("Hello there");
  });

  it("strips a Telegram envelope with ISO timestamp", () => {
    expect(stripChannelEnvelope("[Telegram 2025-01-15T14:30Z] Message content")).toBe(
      "Message content",
    );
  });

  it("strips a Discord envelope", () => {
    expect(stripChannelEnvelope("[Discord 2025-01-15 14:30] Discord message")).toBe(
      "Discord message",
    );
  });

  it("does not strip non-channel brackets", () => {
    expect(stripChannelEnvelope("[random] Some text")).toBe("[random] Some text");
  });

  it("returns plain text unchanged", () => {
    expect(stripChannelEnvelope("No envelope here")).toBe("No envelope here");
  });

  it("returns empty string for empty input", () => {
    expect(stripChannelEnvelope("")).toBe("");
  });

  it("strips envelope with channel name prefix", () => {
    expect(stripChannelEnvelope("[Signal 2025-03-01 09:00] Signal message")).toBe("Signal message");
  });
});
