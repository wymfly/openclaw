import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  parseSmartMetadata,
  buildSmartMetadata,
  stringifySmartMetadata,
  deriveFactKey,
  isMemoryActiveAt,
  appendRelation,
  reverseMapLegacyCategory,
  toLifecycleMemory,
  getDecayableFromEntry,
  normalizeContext,
  parseSupportInfo,
  updateSupportStats,
  MAX_SUPPORT_SLICES,
  SUPPORT_CONTEXT_VOCABULARY,
  type SmartMemoryMetadata,
  type SupportInfoV2,
} from "./smart-metadata.js";

describe("deriveFactKey", () => {
  test("returns undefined for non-temporal categories", () => {
    expect(deriveFactKey("events", "Something happened")).toBeUndefined();
    expect(deriveFactKey("cases", "Bug fix")).toBeUndefined();
    expect(deriveFactKey("profile", "User info")).toBeUndefined();
    expect(deriveFactKey("patterns", "A pattern")).toBeUndefined();
  });

  test("returns fact key for temporal versioned categories", () => {
    expect(deriveFactKey("preferences", "Python代码风格：无类型注解")).toBe(
      "preferences:python代码风格",
    );
    expect(deriveFactKey("entities", "Project status: active")).toBe("entities:project status");
  });

  test("extracts topic before colon", () => {
    expect(deriveFactKey("preferences", "Editor preference: VS Code")).toBe(
      "preferences:editor preference",
    );
    expect(deriveFactKey("preferences", "编辑器偏好：Zed")).toBe("preferences:编辑器偏好");
  });

  test("extracts topic before arrow", () => {
    expect(deriveFactKey("entities", "Server status -> running")).toBe("entities:server status");
    expect(deriveFactKey("entities", "API version => v2")).toBe("entities:api version");
  });

  test("returns undefined for empty abstract", () => {
    expect(deriveFactKey("preferences", "")).toBeUndefined();
    expect(deriveFactKey("preferences", "   ")).toBeUndefined();
  });
});

describe("parseSmartMetadata", () => {
  test("parses valid JSON metadata", () => {
    const raw = JSON.stringify({
      l0_abstract: "Test abstract",
      l1_overview: "Test overview",
      l2_content: "Test content",
      memory_category: "preferences",
      tier: "core",
      access_count: 5,
      confidence: 0.9,
      last_accessed_at: 1000,
      valid_from: 500,
    });
    const result = parseSmartMetadata(raw, { text: "fallback" });
    expect(result.l0_abstract).toBe("Test abstract");
    expect(result.l1_overview).toBe("Test overview");
    expect(result.l2_content).toBe("Test content");
    expect(result.memory_category).toBe("preferences");
    expect(result.tier).toBe("core");
    expect(result.access_count).toBe(5);
    expect(result.confidence).toBe(0.9);
  });

  test("provides defaults for missing metadata", () => {
    const result = parseSmartMetadata(undefined, {
      text: "Some text",
      timestamp: 1000,
    });
    expect(result.l0_abstract).toBe("Some text");
    expect(result.l2_content).toBe("Some text");
    expect(result.tier).toBe("working");
    expect(result.confidence).toBe(0.7);
    expect(result.access_count).toBe(0);
  });

  test("handles invalid JSON gracefully", () => {
    const result = parseSmartMetadata("not json", { text: "fallback" });
    expect(result.l0_abstract).toBe("fallback");
    expect(result.tier).toBe("working");
  });

  test("normalizes tier to valid value", () => {
    const raw = JSON.stringify({ tier: "invalid" });
    const result = parseSmartMetadata(raw);
    expect(result.tier).toBe("working");
  });

  test("clamps confidence to 0-1 range", () => {
    const raw = JSON.stringify({ confidence: 1.5 });
    const result = parseSmartMetadata(raw);
    expect(result.confidence).toBe(1);
  });

  test("derives fact_key when not provided", () => {
    const raw = JSON.stringify({
      memory_category: "preferences",
      l0_abstract: "Editor: VS Code",
    });
    const result = parseSmartMetadata(raw);
    expect(result.fact_key).toBe("preferences:editor");
  });

  test("invalidated_at must be >= valid_from", () => {
    const raw = JSON.stringify({
      valid_from: 1000,
      invalidated_at: 500, // before valid_from
    });
    const result = parseSmartMetadata(raw);
    expect(result.invalidated_at).toBeUndefined();
  });
});

describe("buildSmartMetadata", () => {
  test("builds metadata from entry with patches", () => {
    const entry = {
      text: "Original text",
      timestamp: 1000,
      importance: 0.8,
    };
    const result = buildSmartMetadata(entry, {
      l0_abstract: "Patched abstract",
      tier: "core",
    });
    expect(result.l0_abstract).toBe("Patched abstract");
    expect(result.tier).toBe("core");
    expect(result.l2_content).toBe("Original text");
  });

  test("preserves base values when no patch provided", () => {
    const entry = {
      text: "Some text",
      metadata: JSON.stringify({
        l0_abstract: "Existing abstract",
        confidence: 0.95,
      }),
      timestamp: 1000,
    };
    const result = buildSmartMetadata(entry);
    expect(result.l0_abstract).toBe("Existing abstract");
    expect(result.confidence).toBe(0.95);
  });
});

describe("stringifySmartMetadata", () => {
  test("serializes metadata to JSON", () => {
    const meta: SmartMemoryMetadata = {
      l0_abstract: "test",
      l1_overview: "overview",
      l2_content: "content",
      memory_category: "profile",
      tier: "working",
      access_count: 0,
      confidence: 0.7,
      last_accessed_at: 1000,
      valid_from: 1000,
    };
    const json = stringifySmartMetadata(meta);
    const parsed = JSON.parse(json);
    expect(parsed.l0_abstract).toBe("test");
  });

  test("caps array fields to prevent bloat", () => {
    const meta = {
      l0_abstract: "test",
      sources: Array.from({ length: 30 }, (_, i) => `source-${i}`),
      history: Array.from({ length: 60 }, (_, i) => `history-${i}`),
      relations: Array.from({ length: 20 }, (_, i) => ({ type: "ref", targetId: `id-${i}` })),
    };
    const json = stringifySmartMetadata(meta);
    const parsed = JSON.parse(json);
    expect(parsed.sources.length).toBe(20);
    expect(parsed.history.length).toBe(50);
    expect(parsed.relations.length).toBe(16);
  });
});

describe("isMemoryActiveAt", () => {
  test("active when valid_from <= at and no invalidation", () => {
    expect(isMemoryActiveAt({ valid_from: 100 }, 200)).toBe(true);
  });

  test("inactive when valid_from > at", () => {
    expect(isMemoryActiveAt({ valid_from: 300 }, 200)).toBe(false);
  });

  test("active when invalidated_at > at", () => {
    expect(isMemoryActiveAt({ valid_from: 100, invalidated_at: 300 }, 200)).toBe(true);
  });

  test("inactive when invalidated_at <= at", () => {
    expect(isMemoryActiveAt({ valid_from: 100, invalidated_at: 150 }, 200)).toBe(false);
  });
});

describe("appendRelation", () => {
  test("appends new relation to empty array", () => {
    const result = appendRelation([], { type: "supports", targetId: "mem-1" });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "supports", targetId: "mem-1" });
  });

  test("deduplicates by type+targetId", () => {
    const existing = [{ type: "supports", targetId: "mem-1" }];
    const result = appendRelation(existing, { type: "supports", targetId: "mem-1" });
    expect(result).toHaveLength(1);
  });

  test("allows different type for same targetId", () => {
    const existing = [{ type: "supports", targetId: "mem-1" }];
    const result = appendRelation(existing, { type: "contradicts", targetId: "mem-1" });
    expect(result).toHaveLength(2);
  });

  test("handles non-array input gracefully", () => {
    const result = appendRelation(null, { type: "ref", targetId: "x" });
    expect(result).toHaveLength(1);
  });
});

describe("reverseMapLegacyCategory", () => {
  test("maps legacy categories correctly", () => {
    expect(reverseMapLegacyCategory("preference")).toBe("preferences");
    expect(reverseMapLegacyCategory("entity")).toBe("entities");
    expect(reverseMapLegacyCategory("decision")).toBe("events");
    expect(reverseMapLegacyCategory("other")).toBe("patterns");
  });

  test("maps 'fact' based on text content", () => {
    expect(reverseMapLegacyCategory("fact", "my name is Alice")).toBe("profile");
    expect(reverseMapLegacyCategory("fact", "I am a developer")).toBe("profile");
    expect(reverseMapLegacyCategory("fact", "The API uses REST")).toBe("cases");
  });

  test("defaults to patterns for unknown categories", () => {
    expect(reverseMapLegacyCategory(undefined)).toBe("patterns");
  });
});

describe("toLifecycleMemory", () => {
  test("converts entry to lifecycle memory", () => {
    const result = toLifecycleMemory("mem-1", {
      importance: 0.9,
      timestamp: 1000,
      metadata: JSON.stringify({ confidence: 0.8, tier: "core", access_count: 3 }),
    });
    expect(result.id).toBe("mem-1");
    expect(result.importance).toBe(0.9);
    expect(result.confidence).toBe(0.8);
    expect(result.tier).toBe("core");
    expect(result.accessCount).toBe(3);
    expect(result.createdAt).toBe(1000);
  });
});

describe("getDecayableFromEntry", () => {
  test("extracts decayable memory and metadata", () => {
    const entry = {
      id: "mem-2",
      text: "Test",
      importance: 0.85,
      timestamp: 2000,
      metadata: JSON.stringify({
        confidence: 0.9,
        tier: "peripheral",
        access_count: 10,
        last_accessed_at: 3000,
      }),
    };
    const { memory, meta } = getDecayableFromEntry(entry);
    expect(memory.id).toBe("mem-2");
    expect(memory.importance).toBe(0.85);
    expect(memory.confidence).toBe(0.9);
    expect(memory.tier).toBe("peripheral");
    expect(memory.accessCount).toBe(10);
    expect(meta.tier).toBe("peripheral");
  });
});

describe("normalizeContext", () => {
  test("returns 'general' for empty/undefined input", () => {
    expect(normalizeContext(undefined)).toBe("general");
    expect(normalizeContext("")).toBe("general");
    expect(normalizeContext("  ")).toBe("general");
  });

  test("matches vocabulary directly", () => {
    expect(normalizeContext("morning")).toBe("morning");
    expect(normalizeContext("evening")).toBe("evening");
    expect(normalizeContext("Weekend")).toBe("weekend");
  });

  test("maps Chinese aliases", () => {
    expect(normalizeContext("早上")).toBe("morning");
    expect(normalizeContext("晚上")).toBe("evening");
    expect(normalizeContext("周末")).toBe("weekend");
    expect(normalizeContext("工作")).toBe("work");
    expect(normalizeContext("夏天")).toBe("summer");
  });

  test("returns custom context for unmapped values", () => {
    expect(normalizeContext("custom-time")).toBe("custom-time");
  });
});

describe("parseSupportInfo", () => {
  test("returns default for null/undefined", () => {
    const result = parseSupportInfo(null);
    expect(result.global_strength).toBe(0.5);
    expect(result.total_observations).toBe(0);
    expect(result.slices).toHaveLength(0);
  });

  test("parses V2 format with slices", () => {
    const v2 = {
      global_strength: 0.8,
      total_observations: 5,
      slices: [
        {
          context: "morning",
          confirmations: 3,
          contradictions: 1,
          strength: 0.75,
          last_observed_at: 1000,
        },
      ],
    };
    const result = parseSupportInfo(v2);
    expect(result.global_strength).toBe(0.8);
    expect(result.slices).toHaveLength(1);
    expect(result.slices[0].context).toBe("morning");
  });

  test("migrates V1 format to V2", () => {
    const v1 = { confirmations: 4, contradictions: 1 };
    const result = parseSupportInfo(v1);
    expect(result.global_strength).toBe(0.8);
    expect(result.total_observations).toBe(5);
    expect(result.slices).toHaveLength(1);
    expect(result.slices[0].context).toBe("general");
  });
});

describe("updateSupportStats", () => {
  test("increments confirmation for support event", () => {
    const existing: SupportInfoV2 = {
      global_strength: 0.5,
      total_observations: 0,
      slices: [],
    };
    const result = updateSupportStats(existing, "morning", "support");
    expect(result.slices).toHaveLength(1);
    expect(result.slices[0].confirmations).toBe(1);
    expect(result.slices[0].contradictions).toBe(0);
    expect(result.slices[0].strength).toBe(1);
  });

  test("increments contradiction for contradict event", () => {
    const existing: SupportInfoV2 = {
      global_strength: 0.5,
      total_observations: 0,
      slices: [],
    };
    const result = updateSupportStats(existing, "evening", "contradict");
    expect(result.slices[0].contradictions).toBe(1);
    expect(result.slices[0].strength).toBe(0);
  });

  test("updates existing slice", () => {
    const existing: SupportInfoV2 = {
      global_strength: 1,
      total_observations: 1,
      slices: [
        {
          context: "morning",
          confirmations: 1,
          contradictions: 0,
          strength: 1,
          last_observed_at: 1000,
        },
      ],
    };
    const result = updateSupportStats(existing, "morning", "contradict");
    expect(result.slices).toHaveLength(1);
    expect(result.slices[0].confirmations).toBe(1);
    expect(result.slices[0].contradictions).toBe(1);
    expect(result.slices[0].strength).toBe(0.5);
  });

  test("caps slices at MAX_SUPPORT_SLICES", () => {
    const slices = Array.from({ length: MAX_SUPPORT_SLICES }, (_, i) => ({
      context: `ctx-${i}`,
      confirmations: 1,
      contradictions: 0,
      strength: 1,
      last_observed_at: 1000 + i,
    }));
    const existing: SupportInfoV2 = {
      global_strength: 1,
      total_observations: MAX_SUPPORT_SLICES,
      slices,
    };
    const result = updateSupportStats(existing, "brand-new-context", "support");
    expect(result.slices.length).toBeLessThanOrEqual(MAX_SUPPORT_SLICES);
  });
});
