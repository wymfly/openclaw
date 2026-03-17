import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Embedder } from "./embedder.js";
import type { LlmClient } from "./llm-client.js";
import { SmartExtractor, type SmartExtractorConfig } from "./smart-extractor.js";

// ---------------------------------------------------------------------------
// Mock Store
// ---------------------------------------------------------------------------

function createMockStore() {
  const entries = new Map<
    string,
    {
      id: string;
      text: string;
      vector: number[];
      category: string;
      scope: string;
      importance: number;
      timestamp: number;
      metadata?: string;
    }
  >();
  let nextId = 1;

  return {
    entries,
    hasFtsSupport: false,
    hasId: vi.fn(async (id: string) => entries.has(id)),
    getById: vi.fn(async (id: string) => entries.get(id) ?? null),
    vectorSearch: vi.fn(async () => [] as Array<{ entry: any; score: number }>),
    bm25Search: vi.fn(async () => []),
    update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const existing = entries.get(id);
      if (existing) {
        entries.set(id, { ...existing, ...patch });
      }
    }),
    store: vi.fn(async (entry: Record<string, unknown>) => {
      const id = `mem-${nextId++}`;
      const stored = { id, timestamp: Date.now(), ...entry } as any;
      entries.set(id, stored);
      return stored;
    }),
  };
}

// ---------------------------------------------------------------------------
// Mock Embedder
// ---------------------------------------------------------------------------

function createMockEmbedder(): Embedder {
  return {
    embed: vi.fn(async () => [0.1, 0.2, 0.3]),
    dimensions: 3,
  };
}

// ---------------------------------------------------------------------------
// Mock LLM Client
// ---------------------------------------------------------------------------

function createMockLlmClient(responses: Record<string, unknown>): LlmClient {
  let callCount = 0;
  const labels: string[] = [];
  return {
    completeJson: vi.fn(async <T>(_prompt: string, label?: string): Promise<T | null> => {
      labels.push(label ?? "");
      if (label === "extract-candidates") {
        return (responses.extract ?? null) as T | null;
      }
      if (label === "dedup-decision") {
        return (responses.dedup ?? null) as T | null;
      }
      if (label === "merge-memory") {
        return (responses.merge ?? null) as T | null;
      }
      return null;
    }),
    getLastError: () => null,
  };
}

describe("SmartExtractor", () => {
  let store: ReturnType<typeof createMockStore>;
  let embedder: Embedder;

  beforeEach(() => {
    store = createMockStore();
    embedder = createMockEmbedder();
  });

  test("returns zero stats when LLM extracts nothing", async () => {
    const llm = createMockLlmClient({
      extract: { memories: [] },
    });
    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
    });

    const stats = await extractor.extractAndPersist("Hello, how are you?");
    expect(stats.created).toBe(0);
    expect(stats.merged).toBe(0);
    expect(stats.skipped).toBe(0);
  });

  test("creates new memory when no similar exist", async () => {
    const llm = createMockLlmClient({
      extract: {
        memories: [
          {
            category: "preferences",
            abstract: "User prefers dark mode in all editors",
            overview: "## Preferences\n- Dark mode",
            content: "User strongly prefers dark mode.",
          },
        ],
      },
      dedup: { decision: "create", reason: "No similar memories" },
    });

    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
    });

    const stats = await extractor.extractAndPersist("I like dark mode");
    expect(stats.created).toBe(1);
    expect(store.store).toHaveBeenCalled();
  });

  test("skips duplicate memories", async () => {
    // Pre-populate store with existing memory
    store.entries.set("existing-1", {
      id: "existing-1",
      text: "User prefers dark mode",
      vector: [0.1, 0.2, 0.3],
      category: "preference",
      scope: "global",
      importance: 0.8,
      timestamp: 1000,
      metadata: JSON.stringify({
        memory_category: "preferences",
        l0_abstract: "User prefers dark mode",
      }),
    });
    store.vectorSearch.mockResolvedValueOnce([
      {
        entry: store.entries.get("existing-1"),
        score: 0.95,
      },
    ]);

    const llm = createMockLlmClient({
      extract: {
        memories: [
          {
            category: "preferences",
            abstract: "User prefers dark mode in all editors",
            overview: "Dark mode preference",
            content: "User prefers dark mode.",
          },
        ],
      },
      dedup: { decision: "skip", reason: "Duplicate of existing memory" },
    });

    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
    });

    const stats = await extractor.extractAndPersist("Dark mode please");
    expect(stats.skipped).toBe(1);
    expect(stats.created).toBe(0);
  });

  test("merges into existing memory", async () => {
    store.entries.set("existing-2", {
      id: "existing-2",
      text: "User prefers Python",
      vector: [0.1, 0.2, 0.3],
      category: "preference",
      scope: "global",
      importance: 0.8,
      timestamp: 1000,
      metadata: JSON.stringify({
        memory_category: "preferences",
        l0_abstract: "User prefers Python",
        l1_overview: "Python preference",
        l2_content: "User prefers Python for scripting.",
      }),
    });
    store.vectorSearch.mockResolvedValueOnce([
      {
        entry: store.entries.get("existing-2"),
        score: 0.85,
      },
    ]);

    const llm = createMockLlmClient({
      extract: {
        memories: [
          {
            category: "preferences",
            abstract: "User prefers Python with type hints",
            overview: "Python + type hints",
            content: "User prefers Python with type hints.",
          },
        ],
      },
      dedup: { decision: "merge", match_index: 1, reason: "Adds type hint detail" },
      merge: {
        abstract: "User prefers Python with type hints",
        overview: "Full Python preference",
        content: "User prefers Python for scripting with type hints.",
      },
    });

    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
    });

    const stats = await extractor.extractAndPersist("I like Python with type hints");
    expect(stats.merged).toBe(1);
    expect(store.update).toHaveBeenCalled();
  });

  test("handles profile always-merge category", async () => {
    const llm = createMockLlmClient({
      extract: {
        memories: [
          {
            category: "profile",
            abstract: "User is an AI engineer",
            overview: "## Background\n- Occupation: AI engineer",
            content: "User is an AI development engineer.",
          },
        ],
      },
    });

    // No existing profile found
    store.vectorSearch.mockResolvedValueOnce([]);

    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
    });

    const stats = await extractor.extractAndPersist("I'm an AI engineer");
    // Profile with no existing match = stored as new
    expect(stats.merged).toBe(1);
    expect(store.store).toHaveBeenCalled();
  });

  test("supersedes temporal versioned memory", async () => {
    store.entries.set("old-pref", {
      id: "old-pref",
      text: "Preferred editor: VS Code",
      vector: [0.1, 0.2, 0.3],
      category: "preference",
      scope: "global",
      importance: 0.8,
      timestamp: 1000,
      metadata: JSON.stringify({
        memory_category: "preferences",
        l0_abstract: "Preferred editor: VS Code",
        valid_from: 1000,
      }),
    });
    store.vectorSearch.mockResolvedValueOnce([
      {
        entry: store.entries.get("old-pref"),
        score: 0.9,
      },
    ]);

    const llm = createMockLlmClient({
      extract: {
        memories: [
          {
            category: "preferences",
            abstract: "Preferred editor: Zed",
            overview: "Editor preference updated",
            content: "User now prefers Zed editor.",
          },
        ],
      },
      dedup: { decision: "supersede", match_index: 1, reason: "Editor changed to Zed" },
    });

    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
    });

    const stats = await extractor.extractAndPersist("I switched to Zed editor");
    expect(stats.created).toBe(1);
    expect(stats.superseded).toBe(1);
    // Old memory should be updated with invalidated_at
    expect(store.update).toHaveBeenCalled();
    // New memory should be stored
    expect(store.store).toHaveBeenCalled();
  });

  test("handles support decision", async () => {
    store.entries.set("existing-3", {
      id: "existing-3",
      text: "User drinks tea in the evening",
      vector: [0.1, 0.2, 0.3],
      category: "preference",
      scope: "global",
      importance: 0.8,
      timestamp: 1000,
      metadata: JSON.stringify({
        memory_category: "preferences",
        l0_abstract: "User drinks tea in the evening",
      }),
    });
    store.vectorSearch.mockResolvedValueOnce([
      {
        entry: store.entries.get("existing-3"),
        score: 0.88,
      },
    ]);

    const llm = createMockLlmClient({
      extract: {
        memories: [
          {
            category: "preferences",
            abstract: "Still prefers tea in the evening",
            overview: "Tea preference confirmed",
            content: "User still prefers tea at night.",
          },
        ],
      },
      dedup: {
        decision: "support",
        match_index: 1,
        reason: "Confirms existing preference",
        context_label: "evening",
      },
    });

    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
    });

    const stats = await extractor.extractAndPersist("I still like tea at night");
    expect(stats.supported).toBe(1);
    expect(store.update).toHaveBeenCalled();
  });

  test("limits extraction to MAX_MEMORIES_PER_EXTRACTION (5)", async () => {
    const llm = createMockLlmClient({
      extract: {
        memories: Array.from({ length: 8 }, (_, i) => ({
          category: "events",
          abstract: `Event ${i + 1} happened today with details`,
          overview: `Event ${i + 1}`,
          content: `Event ${i + 1} details`,
        })),
      },
      dedup: { decision: "create", reason: "New event" },
    });

    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
    });

    const stats = await extractor.extractAndPersist("Many events happened");
    expect(stats.created).toBe(5); // capped at 5
  });

  test("filters invalid categories from LLM output", async () => {
    const llm = createMockLlmClient({
      extract: {
        memories: [
          {
            category: "invalid_cat",
            abstract: "Something with invalid category",
            overview: "x",
            content: "y",
          },
          {
            category: "preferences",
            abstract: "Valid preference extracted here",
            overview: "o",
            content: "c",
          },
        ],
      },
      dedup: { decision: "create", reason: "New" },
    });

    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
    });

    const stats = await extractor.extractAndPersist("test");
    expect(stats.created).toBe(1); // only the valid one
  });

  test("skips noise abstracts", async () => {
    const llm = createMockLlmClient({
      extract: {
        memories: [
          { category: "preferences", abstract: "hi", overview: "", content: "" }, // too short
          {
            category: "preferences",
            abstract: "User prefers TypeScript for backend",
            overview: "o",
            content: "c",
          },
        ],
      },
      dedup: { decision: "create", reason: "New" },
    });

    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
    });

    const stats = await extractor.extractAndPersist("test");
    expect(stats.created).toBe(1); // short abstract filtered
  });

  test("skips workspace-boundary exclusive memories", async () => {
    const llm = createMockLlmClient({
      extract: {
        memories: [
          {
            category: "profile",
            abstract: "User profile: AI engineer with 5 years experience",
            overview: "## Background\n- Role: AI Engineer",
            content: "User is an AI engineer.",
          },
        ],
      },
    });

    const extractor = new SmartExtractor(store as any, embedder, llm, {
      log: () => {},
      debugLog: () => {},
      workspaceBoundary: {
        userMdExclusive: { enabled: true, routeProfile: true },
      },
    });

    const stats = await extractor.extractAndPersist("I'm an AI engineer");
    expect(stats.skipped).toBe(1);
    expect(stats.boundarySkipped).toBe(1);
    expect(stats.created).toBe(0);
  });
});
