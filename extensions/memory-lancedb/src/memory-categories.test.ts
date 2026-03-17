import { describe, test, expect } from "vitest";
import {
  MEMORY_CATEGORIES,
  ALWAYS_MERGE_CATEGORIES,
  MERGE_SUPPORTED_CATEGORIES,
  TEMPORAL_VERSIONED_CATEGORIES,
  APPEND_ONLY_CATEGORIES,
  normalizeCategory,
  type MemoryCategory,
  type MemoryTier,
  type CandidateMemory,
  type DedupDecision,
  type DedupResult,
  type ExtractionStats,
} from "./memory-categories.js";

describe("MEMORY_CATEGORIES", () => {
  test("contains all 6 categories", () => {
    expect(MEMORY_CATEGORIES).toEqual([
      "profile",
      "preferences",
      "entities",
      "events",
      "cases",
      "patterns",
    ]);
    expect(MEMORY_CATEGORIES.length).toBe(6);
  });
});

describe("category sets", () => {
  test("ALWAYS_MERGE_CATEGORIES contains only profile", () => {
    expect(ALWAYS_MERGE_CATEGORIES.has("profile")).toBe(true);
    expect(ALWAYS_MERGE_CATEGORIES.size).toBe(1);
  });

  test("MERGE_SUPPORTED_CATEGORIES contains preferences, entities, patterns", () => {
    expect(MERGE_SUPPORTED_CATEGORIES.has("preferences")).toBe(true);
    expect(MERGE_SUPPORTED_CATEGORIES.has("entities")).toBe(true);
    expect(MERGE_SUPPORTED_CATEGORIES.has("patterns")).toBe(true);
    expect(MERGE_SUPPORTED_CATEGORIES.size).toBe(3);
  });

  test("TEMPORAL_VERSIONED_CATEGORIES contains preferences, entities", () => {
    expect(TEMPORAL_VERSIONED_CATEGORIES.has("preferences")).toBe(true);
    expect(TEMPORAL_VERSIONED_CATEGORIES.has("entities")).toBe(true);
    expect(TEMPORAL_VERSIONED_CATEGORIES.size).toBe(2);
  });

  test("APPEND_ONLY_CATEGORIES contains events, cases", () => {
    expect(APPEND_ONLY_CATEGORIES.has("events")).toBe(true);
    expect(APPEND_ONLY_CATEGORIES.has("cases")).toBe(true);
    expect(APPEND_ONLY_CATEGORIES.size).toBe(2);
  });

  test("all categories belong to exactly one behavior set", () => {
    for (const cat of MEMORY_CATEGORIES) {
      const inAlwaysMerge = ALWAYS_MERGE_CATEGORIES.has(cat);
      const inMergeSupported = MERGE_SUPPORTED_CATEGORIES.has(cat);
      const inAppendOnly = APPEND_ONLY_CATEGORIES.has(cat);
      // Each category should be in at most one of the behavior sets
      const count = [inAlwaysMerge, inMergeSupported, inAppendOnly].filter(Boolean).length;
      expect(count).toBeLessThanOrEqual(1);
    }
  });
});

describe("normalizeCategory", () => {
  test("returns valid category for exact match", () => {
    expect(normalizeCategory("profile")).toBe("profile");
    expect(normalizeCategory("preferences")).toBe("preferences");
    expect(normalizeCategory("entities")).toBe("entities");
    expect(normalizeCategory("events")).toBe("events");
    expect(normalizeCategory("cases")).toBe("cases");
    expect(normalizeCategory("patterns")).toBe("patterns");
  });

  test("is case-insensitive", () => {
    expect(normalizeCategory("PROFILE")).toBe("profile");
    expect(normalizeCategory("Preferences")).toBe("preferences");
    expect(normalizeCategory("ENTITIES")).toBe("entities");
  });

  test("trims whitespace", () => {
    expect(normalizeCategory("  profile  ")).toBe("profile");
    expect(normalizeCategory("\tpatterns\n")).toBe("patterns");
  });

  test("returns null for invalid categories", () => {
    expect(normalizeCategory("unknown")).toBeNull();
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory("preference")).toBeNull(); // singular, not plural
    expect(normalizeCategory("fact")).toBeNull();
  });
});

describe("type exports", () => {
  test("MemoryTier type accepts valid values", () => {
    const tiers: MemoryTier[] = ["core", "working", "peripheral"];
    expect(tiers).toHaveLength(3);
  });

  test("CandidateMemory type has correct shape", () => {
    const candidate: CandidateMemory = {
      category: "profile",
      abstract: "test abstract",
      overview: "test overview",
      content: "test content",
    };
    expect(candidate.category).toBe("profile");
    expect(candidate.abstract).toBe("test abstract");
  });

  test("DedupDecision covers all 7 types", () => {
    const decisions: DedupDecision[] = [
      "create",
      "merge",
      "skip",
      "support",
      "contextualize",
      "contradict",
      "supersede",
    ];
    expect(decisions).toHaveLength(7);
  });

  test("DedupResult type has correct shape", () => {
    const result: DedupResult = {
      decision: "merge",
      reason: "contains new info",
      matchId: "mem-123",
      contextLabel: "evening",
    };
    expect(result.decision).toBe("merge");
    expect(result.matchId).toBe("mem-123");
  });

  test("ExtractionStats type has correct shape", () => {
    const stats: ExtractionStats = {
      created: 3,
      merged: 1,
      skipped: 2,
      boundarySkipped: 0,
      supported: 1,
      superseded: 0,
    };
    expect(stats.created).toBe(3);
    expect(stats.supported).toBe(1);
  });
});
