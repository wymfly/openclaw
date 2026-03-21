import { describe, it, expect } from "vitest";
import {
  sanitizeTagValue,
  extractActionName,
  formatA2UIAgentMessage,
} from "../a2ui-message-format";

describe("sanitizeTagValue", () => {
  it("replaces spaces with underscores", () => {
    expect(sanitizeTagValue("Hello World")).toBe("Hello_World");
  });
  it("replaces non-alphanumeric chars", () => {
    expect(sanitizeTagValue("test<>!")).toBe("test___");
  });
  it("returns dash for empty/whitespace", () => {
    expect(sanitizeTagValue("  ")).toBe("-");
  });
  it("allows dots, dashes, colons", () => {
    expect(sanitizeTagValue("macOS_26.2")).toBe("macOS_26.2");
  });
});

describe("extractActionName", () => {
  it("extracts from name field", () => {
    expect(extractActionName({ name: "Hello" })).toBe("Hello");
  });
  it("falls back to action field", () => {
    expect(extractActionName({ action: "Wave" })).toBe("Wave");
  });
  it("returns null for empty", () => {
    expect(extractActionName({ name: " " })).toBeNull();
  });
});

describe("formatA2UIAgentMessage", () => {
  it("formats matching native client output", () => {
    const msg = formatA2UIAgentMessage({
      actionName: "Buy",
      sessionKey: "main",
      surfaceId: "main",
      sourceComponentId: "btn1",
    });
    expect(msg).toBe(
      "CANVAS_A2UI action=Buy session=main surface=main component=btn1 host=Deck instance=deck default=update_canvas",
    );
  });
  it("includes context when provided", () => {
    const msg = formatA2UIAgentMessage({
      actionName: "Buy",
      sessionKey: "main",
      surfaceId: "main",
      sourceComponentId: "btn1",
      contextJson: '{"t":123}',
    });
    expect(msg).toContain('ctx={"t":123}');
  });
});
