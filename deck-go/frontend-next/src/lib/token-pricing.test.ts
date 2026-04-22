import { describe, it, expect } from "vitest";
import { getModelPricing, calculateTokenCost, normalizedModelName } from "./token-pricing.js";

describe("normalizedModelName", () => {
  it("lowercases and trims whitespace", () => {
    expect(normalizedModelName("  Claude-Sonnet-4  ")).toBe("claude-sonnet-4");
  });
});

describe("getModelPricing", () => {
  it("returns exact pricing for a fully qualified model name", () => {
    const pricing = getModelPricing("anthropic/claude-sonnet-4-20250514");
    expect(pricing.inputPerMTok).toBe(3.0);
    expect(pricing.outputPerMTok).toBe(15.0);
  });

  it("returns exact pricing for a short model name", () => {
    const pricing = getModelPricing("claude-sonnet-4");
    expect(pricing.inputPerMTok).toBe(3.0);
    expect(pricing.outputPerMTok).toBe(15.0);
  });

  it("returns pricing via fuzzy match on short name substring", () => {
    // "claude-3-5-haiku" is a key; a model string containing it should match
    const pricing = getModelPricing("my-proxy/claude-3-5-haiku-20250101");
    expect(pricing.inputPerMTok).toBe(0.8);
    expect(pricing.outputPerMTok).toBe(4.0);
  });

  it("returns default pricing for an unknown model", () => {
    const pricing = getModelPricing("totally-unknown-model-xyz");
    expect(pricing.inputPerMTok).toBe(3.0);
    expect(pricing.outputPerMTok).toBe(15.0);
  });

  it("returns zero pricing for free/local models (ollama)", () => {
    const pricing = getModelPricing("ollama/deepseek-r1:14b");
    expect(pricing.inputPerMTok).toBe(0.0);
    expect(pricing.outputPerMTok).toBe(0.0);
  });

  it("returns DeepSeek pricing", () => {
    const pricing = getModelPricing("deepseek/deepseek-chat-v3");
    expect(pricing.inputPerMTok).toBe(0.27);
    expect(pricing.outputPerMTok).toBe(1.1);
  });

  it("is case-insensitive", () => {
    const pricing = getModelPricing("Anthropic/Claude-Opus-4-5");
    expect(pricing.inputPerMTok).toBe(15.0);
    expect(pricing.outputPerMTok).toBe(75.0);
  });
});

describe("calculateTokenCost", () => {
  it("calculates cost based on model pricing", () => {
    // claude-sonnet-4: input=3.0/MTok, output=15.0/MTok
    // 1000 input + 500 output = (1000*3 + 500*15) / 1_000_000 = 10500/1_000_000
    const cost = calculateTokenCost("claude-sonnet-4", 1000, 500);
    expect(cost).toBeCloseTo(0.0105, 6);
  });

  it("returns 0 for zero tokens", () => {
    expect(calculateTokenCost("claude-sonnet-4", 0, 0)).toBe(0);
  });

  it("returns 0 for free models even with many tokens", () => {
    expect(calculateTokenCost("ollama/deepseek-r1:14b", 1_000_000, 1_000_000)).toBe(0);
  });

  it("uses default pricing for unknown models", () => {
    // default: input=3.0, output=15.0
    const cost = calculateTokenCost("unknown-model", 1_000_000, 1_000_000);
    // (1M * 3.0 + 1M * 15.0) / 1M = 18.0
    expect(cost).toBeCloseTo(18.0, 4);
  });

  it("handles large token counts", () => {
    // opus-4-5: input=15.0, output=75.0
    const cost = calculateTokenCost("claude-opus-4-5", 500_000, 200_000);
    // (500000*15 + 200000*75) / 1_000_000 = (7_500_000 + 15_000_000) / 1_000_000 = 22.5
    expect(cost).toBeCloseTo(22.5, 4);
  });
});
