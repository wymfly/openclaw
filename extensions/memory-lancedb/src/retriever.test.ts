import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Embedder } from "./embedder.js";
import { MemoryRetriever, cosineSimilarity, DEFAULT_RETRIEVAL_CONFIG } from "./retriever.js";
import type { MemoryStore, MemoryEntry, MemorySearchResult } from "./store-types.js";

// Helper: create a mock MemoryEntry
function mockEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: overrides.id ?? "id-1",
    text: overrides.text ?? "test memory text",
    vector: overrides.vector ?? [0.1, 0.2, 0.3],
    category: overrides.category ?? "fact",
    scope: overrides.scope ?? "default",
    importance: overrides.importance ?? 0.7,
    timestamp: overrides.timestamp ?? Date.now(),
    metadata: overrides.metadata ?? undefined,
  };
}

// Helper: create a mock search result
function mockSearchResult(entry: Partial<MemoryEntry> = {}, score = 0.8): MemorySearchResult {
  return { entry: mockEntry(entry), score };
}

describe("cosineSimilarity", () => {
  test("identical vectors have similarity 1", () => {
    const v = [1, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  test("orthogonal vectors have similarity 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  test("opposite vectors have similarity -1", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  test("throws for dimension mismatch", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow("Vector dimensions must match");
  });

  test("zero vectors return 0", () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});

describe("MemoryRetriever", () => {
  let mockStore: MemoryStore;
  let mockEmbedder: Embedder;

  beforeEach(() => {
    mockStore = {
      hasId: vi.fn(async () => true),
      getById: vi.fn(async (id: string) => mockEntry({ id })),
      vectorSearch: vi.fn(async () => [
        mockSearchResult({ id: "v1", text: "vector result 1" }, 0.9),
        mockSearchResult({ id: "v2", text: "vector result 2" }, 0.7),
      ]),
      bm25Search: vi.fn(async () => [
        mockSearchResult({ id: "v1", text: "vector result 1" }, 0.8),
        mockSearchResult({ id: "b1", text: "bm25 result 1" }, 0.6),
      ]),
      update: vi.fn(async () => {}),
      hasFtsSupport: true,
    };

    mockEmbedder = {
      embedQuery: vi.fn(async () => [0.1, 0.2, 0.3]),
      embedPassage: vi.fn(async () => [0.1, 0.2, 0.3]),
      embed: vi.fn(async () => [0.1, 0.2, 0.3]),
      dimensions: 3,
    } as unknown as Embedder;
  });

  test("retrieve returns results in vector-only mode", async () => {
    const retriever = new MemoryRetriever(mockStore, mockEmbedder, {
      ...DEFAULT_RETRIEVAL_CONFIG,
      mode: "vector",
      rerank: "none",
      filterNoise: false,
      hardMinScore: 0,
    });

    const results = await retriever.retrieve({
      query: "test query",
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(mockEmbedder.embedQuery).toHaveBeenCalledWith("test query");
  });

  test("retrieve returns results in hybrid mode", async () => {
    const retriever = new MemoryRetriever(mockStore, mockEmbedder, {
      ...DEFAULT_RETRIEVAL_CONFIG,
      mode: "hybrid",
      rerank: "none",
      filterNoise: false,
      hardMinScore: 0,
    });

    const results = await retriever.retrieve({
      query: "test query",
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(mockStore.vectorSearch).toHaveBeenCalled();
    expect(mockStore.bm25Search).toHaveBeenCalled();
  });

  test("RRF fusion merges vector and BM25 results", async () => {
    const retriever = new MemoryRetriever(mockStore, mockEmbedder, {
      ...DEFAULT_RETRIEVAL_CONFIG,
      mode: "hybrid",
      rerank: "none",
      filterNoise: false,
      hardMinScore: 0,
      minScore: 0,
    });

    const results = await retriever.retrieve({
      query: "test query",
      limit: 10,
    });

    // v1 appears in both vector and BM25, b1 only in BM25
    const ids = results.map((r) => r.entry.id);
    expect(ids).toContain("v1");

    // v1 should have both vector and bm25 sources
    const v1Result = results.find((r) => r.entry.id === "v1");
    expect(v1Result?.sources.vector).toBeDefined();
    expect(v1Result?.sources.bm25).toBeDefined();
    expect(v1Result?.sources.fused).toBeDefined();
  });

  test("falls back to vector-only when hasFtsSupport is false", async () => {
    const noFtsStore = { ...mockStore, hasFtsSupport: false };
    const retriever = new MemoryRetriever(noFtsStore, mockEmbedder, {
      ...DEFAULT_RETRIEVAL_CONFIG,
      mode: "hybrid",
      rerank: "none",
      filterNoise: false,
      hardMinScore: 0,
    });

    await retriever.retrieve({ query: "test", limit: 5 });

    // Should NOT call bm25Search
    expect(noFtsStore.bm25Search).not.toHaveBeenCalled();
    expect(noFtsStore.vectorSearch).toHaveBeenCalled();
  });

  test("records access for manual retrieval source", async () => {
    const retriever = new MemoryRetriever(mockStore, mockEmbedder, {
      ...DEFAULT_RETRIEVAL_CONFIG,
      mode: "vector",
      rerank: "none",
      filterNoise: false,
      hardMinScore: 0,
    });

    const mockTracker = {
      recordAccess: vi.fn(),
    };
    // oxlint-disable-next-line typescript/no-explicit-any
    retriever.setAccessTracker(mockTracker as any);

    await retriever.retrieve({
      query: "test",
      limit: 5,
      source: "manual",
    });

    expect(mockTracker.recordAccess).toHaveBeenCalled();
  });

  test("does not record access for auto-recall source", async () => {
    const retriever = new MemoryRetriever(mockStore, mockEmbedder, {
      ...DEFAULT_RETRIEVAL_CONFIG,
      mode: "vector",
      rerank: "none",
      filterNoise: false,
      hardMinScore: 0,
    });

    const mockTracker = {
      recordAccess: vi.fn(),
    };
    // oxlint-disable-next-line typescript/no-explicit-any
    retriever.setAccessTracker(mockTracker as any);

    await retriever.retrieve({
      query: "test",
      limit: 5,
      source: "auto-recall",
    });

    expect(mockTracker.recordAccess).not.toHaveBeenCalled();
  });

  test("updateConfig and getConfig work correctly", () => {
    const retriever = new MemoryRetriever(mockStore, mockEmbedder, DEFAULT_RETRIEVAL_CONFIG);

    retriever.updateConfig({ minScore: 0.5, mode: "vector" });
    const config = retriever.getConfig();
    expect(config.minScore).toBe(0.5);
    expect(config.mode).toBe("vector");
    // Other defaults should be preserved
    expect(config.vectorWeight).toBe(0.7);
  });

  test("limit is clamped to [1, 20]", async () => {
    const retriever = new MemoryRetriever(mockStore, mockEmbedder, {
      ...DEFAULT_RETRIEVAL_CONFIG,
      mode: "vector",
      rerank: "none",
      filterNoise: false,
      hardMinScore: 0,
    });

    // Should not throw for edge values
    await expect(retriever.retrieve({ query: "test", limit: 0 })).resolves.toBeDefined();
    await expect(retriever.retrieve({ query: "test", limit: 100 })).resolves.toBeDefined();
  });

  test("BM25 ghost entry filtering skips missing IDs", async () => {
    const ghostStore: MemoryStore = {
      ...mockStore,
      hasId: vi.fn(async (id: string) => id !== "ghost-id"),
      vectorSearch: vi.fn(async () => []),
      bm25Search: vi.fn(async () => [
        mockSearchResult({ id: "real-id", text: "real entry" }, 0.8),
        mockSearchResult({ id: "ghost-id", text: "ghost entry" }, 0.6),
      ]),
    };

    const retriever = new MemoryRetriever(ghostStore, mockEmbedder, {
      ...DEFAULT_RETRIEVAL_CONFIG,
      mode: "hybrid",
      rerank: "none",
      filterNoise: false,
      hardMinScore: 0,
      minScore: 0,
    });

    const results = await retriever.retrieve({ query: "test", limit: 10 });
    const ids = results.map((r) => r.entry.id);
    expect(ids).toContain("real-id");
    expect(ids).not.toContain("ghost-id");
  });
});
