import { describe, it, expect } from "vitest";
import {
  normalizeWecomReasoningPolicy,
  applyWecomReasoningPolicy,
  buildWecomReasoningMergedText,
} from "./reasoning-visibility.js";

describe("normalizeWecomReasoningPolicy", () => {
  it("defaults to separate mode", () => {
    const p = normalizeWecomReasoningPolicy();
    expect(p.mode).toBe("separate");
    expect(p.sendThinkingMessage).toBe(true);
    expect(p.includeInFinalAnswer).toBe(false);
  });

  it("accepts append mode", () => {
    const p = normalizeWecomReasoningPolicy({ mode: "append" });
    expect(p.mode).toBe("append");
    expect(p.sendThinkingMessage).toBe(false);
    expect(p.includeInFinalAnswer).toBe(true);
  });

  it("accepts hidden mode", () => {
    const p = normalizeWecomReasoningPolicy({ mode: "hidden" });
    expect(p.mode).toBe("hidden");
    expect(p.sendThinkingMessage).toBe(false);
    expect(p.includeInFinalAnswer).toBe(false);
  });

  it("normalizes case and whitespace", () => {
    const p = normalizeWecomReasoningPolicy({ mode: "  SEPARATE  " });
    expect(p.mode).toBe("separate");
  });

  it("falls back to separate for unknown mode", () => {
    const p = normalizeWecomReasoningPolicy({ mode: "bogus" });
    expect(p.mode).toBe("separate");
  });

  it("uses custom title", () => {
    const p = normalizeWecomReasoningPolicy({ title: "Reasoning" });
    expect(p.title).toBe("Reasoning");
  });

  it("defaults title to 思考过程", () => {
    const p = normalizeWecomReasoningPolicy();
    expect(p.title).toBe("思考过程");
  });

  it("defaults maxChars to 1200", () => {
    const p = normalizeWecomReasoningPolicy();
    expect(p.maxChars).toBe(1200);
  });

  it("enforces minimum maxChars of 64", () => {
    const p = normalizeWecomReasoningPolicy({ maxChars: 10 });
    expect(p.maxChars).toBe(64);
  });
});

describe("buildWecomReasoningMergedText", () => {
  it("returns only visible text when no reasoning", () => {
    expect(buildWecomReasoningMergedText({ text: "hello" })).toBe("hello");
  });

  it("returns only reasoning with heading when no visible text", () => {
    const result = buildWecomReasoningMergedText({ thinkingContent: "deep thought" });
    expect(result).toBe("思考过程：\ndeep thought");
  });

  it("merges reasoning before visible text", () => {
    const result = buildWecomReasoningMergedText({
      text: "answer",
      thinkingContent: "thought",
    });
    expect(result).toBe("思考过程：\nthought\n\nanswer");
  });

  it("uses custom title", () => {
    const result = buildWecomReasoningMergedText({
      text: "answer",
      thinkingContent: "thought",
      title: "Reasoning",
    });
    expect(result).toBe("Reasoning：\nthought\n\nanswer");
  });

  it("returns empty string when both are empty", () => {
    expect(buildWecomReasoningMergedText({})).toBe("");
  });
});

describe("applyWecomReasoningPolicy", () => {
  it("returns text as-is when no reasoning content", () => {
    const result = applyWecomReasoningPolicy({ text: "hello" });
    expect(result.text).toBe("hello");
    expect(result.thinkingContent).toBe("");
  });

  describe("hidden mode", () => {
    it("strips reasoning entirely", () => {
      const result = applyWecomReasoningPolicy({
        text: "answer",
        thinkingContent: "secret thoughts",
        policy: { mode: "hidden" },
      });
      expect(result.text).toBe("answer");
      expect(result.thinkingContent).toBe("");
      expect(result.effectiveMode).toBe("hidden");
    });
  });

  describe("append mode", () => {
    it("merges reasoning into text", () => {
      const result = applyWecomReasoningPolicy({
        text: "answer",
        thinkingContent: "thought",
        policy: { mode: "append" },
      });
      expect(result.text).toContain("思考过程");
      expect(result.text).toContain("thought");
      expect(result.text).toContain("answer");
      expect(result.thinkingContent).toBe("");
      expect(result.effectiveMode).toBe("append");
    });
  });

  describe("separate mode (default)", () => {
    it("keeps reasoning separate for bot transport", () => {
      const result = applyWecomReasoningPolicy({
        text: "answer",
        thinkingContent: "thought",
        policy: { mode: "separate" },
        transport: "bot",
      });
      expect(result.text).toBe("answer");
      expect(result.thinkingContent).toBe("thought");
      expect(result.effectiveMode).toBe("separate");
    });

    it("falls back to append for agent transport", () => {
      const result = applyWecomReasoningPolicy({
        text: "answer",
        thinkingContent: "thought",
        policy: { mode: "separate" },
        transport: "agent",
      });
      expect(result.text).toContain("thought");
      expect(result.text).toContain("answer");
      expect(result.thinkingContent).toBe("");
      expect(result.effectiveMode).toBe("append");
    });
  });

  describe("stream phase", () => {
    it("keeps reasoning separate for bot in stream phase", () => {
      const result = applyWecomReasoningPolicy({
        text: "partial",
        thinkingContent: "thinking...",
        policy: { mode: "separate" },
        transport: "bot",
        phase: "stream",
      });
      expect(result.thinkingContent).toBe("thinking...");
      expect(result.effectiveMode).toBe("separate");
    });

    it("strips reasoning for non-bot in stream phase with separate mode", () => {
      const result = applyWecomReasoningPolicy({
        text: "partial",
        thinkingContent: "thinking...",
        policy: { mode: "separate" },
        transport: "agent",
        phase: "stream",
      });
      expect(result.thinkingContent).toBe("");
      expect(result.effectiveMode).toBe("append");
    });

    it("strips reasoning in hidden mode during stream", () => {
      const result = applyWecomReasoningPolicy({
        text: "partial",
        thinkingContent: "thinking...",
        policy: { mode: "hidden" },
        phase: "stream",
      });
      expect(result.thinkingContent).toBe("");
      expect(result.effectiveMode).toBe("hidden");
    });
  });

  describe("reasoning trimming", () => {
    it("trims reasoning to maxChars with ellipsis", () => {
      const longThinking = "x".repeat(2000);
      const result = applyWecomReasoningPolicy({
        text: "answer",
        thinkingContent: longThinking,
        policy: { mode: "separate", maxChars: 100 },
      });
      expect(result.thinkingContent.length).toBeLessThanOrEqual(100);
      expect(result.thinkingContent.endsWith("…")).toBe(true);
    });

    it("does not trim short reasoning", () => {
      const result = applyWecomReasoningPolicy({
        text: "answer",
        thinkingContent: "short",
        policy: { mode: "separate", maxChars: 100 },
      });
      expect(result.thinkingContent).toBe("short");
    });
  });
});
