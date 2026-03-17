/**
 * Store Type Definitions
 *
 * Minimal type interfaces extracted from the vendor store module.
 * The actual implementation lives in the existing index.ts (MemoryDB class).
 * These types allow the retriever and access-tracker to compile
 * against a well-defined contract.
 */

export interface MemoryEntry {
  id: string;
  text: string;
  vector: number[];
  category: "preference" | "fact" | "decision" | "entity" | "other" | "reflection";
  scope: string;
  importance: number;
  timestamp: number;
  metadata?: string;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
}

/**
 * Minimal MemoryStore interface for the retriever + access-tracker.
 * The full MemoryStore in the vendor module has more methods; we only
 * declare what the transplanted modules actually use.
 */
export interface MemoryStore {
  /** Check if an ID exists in the store. */
  hasId(id: string): Promise<boolean>;
  /** Get a single entry by ID. */
  getById(id: string): Promise<MemoryEntry | null>;
  /** Vector similarity search. */
  vectorSearch(
    vector: number[],
    limit?: number,
    minScore?: number,
    scopeFilter?: string[],
    options?: { excludeInactive?: boolean },
  ): Promise<MemorySearchResult[]>;
  /** Full-text BM25 search. */
  bm25Search(
    query: string,
    limit?: number,
    scopeFilter?: string[],
    options?: { excludeInactive?: boolean },
  ): Promise<MemorySearchResult[]>;
  /** Update a memory entry's metadata. */
  update(id: string, patch: { metadata?: string }): Promise<void>;
  /** Whether the store supports full-text search. */
  readonly hasFtsSupport: boolean;
}
