/**
 * Hybrid Retrieval System
 * Combines vector search + BM25 full-text search with RRF fusion
 */

import { AccessTracker, computeEffectiveHalfLife, parseAccessMetadata } from "./access-tracker.js";
import type { DecayEngine, DecayableMemory } from "./decay-engine-types.js";
import type { Embedder } from "./embedder.js";
import { filterNoise } from "./noise-filter.js";
import {
  getDecayableFromEntry,
  isMemoryActiveAt,
  parseSmartMetadata,
  toLifecycleMemory,
} from "./smart-metadata-types.js";
import type { MemoryEntry, MemoryStore, MemorySearchResult } from "./store-types.js";
import type { TierManager } from "./tier-manager-types.js";

// ============================================================================
// Types & Configuration
// ============================================================================

export interface RetrievalConfig {
  mode: "hybrid" | "vector";
  vectorWeight: number;
  bm25Weight: number;
  minScore: number;
  rerank: "cross-encoder" | "lightweight" | "none";
  candidatePoolSize: number;
  /** Recency boost half-life in days (default: 14). Set 0 to disable. */
  recencyHalfLifeDays: number;
  /** Max recency boost factor (default: 0.10) */
  recencyWeight: number;
  /** Filter noise from results (default: true) */
  filterNoise: boolean;
  /** Reranker API key (enables cross-encoder reranking) */
  rerankApiKey?: string;
  /** Reranker model (default: jina-reranker-v3) */
  rerankModel?: string;
  /** Reranker API endpoint (default: https://api.jina.ai/v1/rerank). */
  rerankEndpoint?: string;
  /** Reranker provider format. */
  rerankProvider?: "jina" | "siliconflow" | "voyage" | "pinecone" | "dashscope" | "tei";
  /**
   * Length normalization anchor (default: 500 chars). Set 0 to disable.
   */
  lengthNormAnchor: number;
  /**
   * Hard cutoff after rerank (default: 0.35).
   */
  hardMinScore: number;
  /**
   * Time decay half-life in days (default: 60). Set 0 to disable.
   */
  timeDecayHalfLifeDays: number;
  /** Access reinforcement factor (default: 0.5). */
  reinforcementFactor: number;
  /** Max half-life multiplier (default: 3). */
  maxHalfLifeMultiplier: number;
}

export interface RetrievalContext {
  query: string;
  limit: number;
  scopeFilter?: string[];
  category?: string;
  /** Retrieval source: "manual" for user-triggered, "auto-recall" for system-initiated, "cli" for CLI commands. */
  source?: "manual" | "auto-recall" | "cli";
}

export interface RetrievalResult extends MemorySearchResult {
  sources: {
    vector?: { score: number; rank: number };
    bm25?: { score: number; rank: number };
    fused?: { score: number };
    reranked?: { score: number };
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  mode: "hybrid",
  vectorWeight: 0.7,
  bm25Weight: 0.3,
  minScore: 0.3,
  rerank: "cross-encoder",
  candidatePoolSize: 20,
  recencyHalfLifeDays: 14,
  recencyWeight: 0.1,
  filterNoise: true,
  rerankModel: "jina-reranker-v3",
  rerankEndpoint: "https://api.jina.ai/v1/rerank",
  lengthNormAnchor: 500,
  hardMinScore: 0.35,
  timeDecayHalfLifeDays: 60,
  reinforcementFactor: 0.5,
  maxHalfLifeMultiplier: 3,
};

// ============================================================================
// Utility Functions
// ============================================================================

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return Number.isFinite(fallback) ? fallback : 0;
  return Math.min(1, Math.max(0, value));
}

function clamp01WithFloor(value: number, floor: number): number {
  const safeFloor = clamp01(floor, 0);
  return Math.max(safeFloor, clamp01(value, safeFloor));
}

// ============================================================================
// Rerank Provider Adapters
// ============================================================================

type RerankProvider = "jina" | "siliconflow" | "voyage" | "pinecone" | "dashscope" | "tei";

interface RerankItem {
  index: number;
  score: number;
}

/** Build provider-specific request headers and body */
function buildRerankRequest(
  provider: RerankProvider,
  apiKey: string,
  model: string,
  query: string,
  candidates: string[],
  topN: number,
): { headers: Record<string, string>; body: Record<string, unknown> } {
  switch (provider) {
    case "tei":
      return {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: { query, texts: candidates },
      };
    case "dashscope":
      return {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: { model, input: { query, documents: candidates } },
      };
    case "pinecone":
      return {
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
          "X-Pinecone-API-Version": "2024-10",
        },
        body: {
          model,
          query,
          documents: candidates.map((text) => ({ text })),
          top_n: topN,
          rank_fields: ["text"],
        },
      };
    case "voyage":
      return {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: { model, query, documents: candidates, top_k: topN },
      };
    case "siliconflow":
    case "jina":
    default:
      return {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: { model, query, documents: candidates, top_n: topN },
      };
  }
}

/** Parse provider-specific response into unified format */
function parseRerankResponse(provider: RerankProvider, data: unknown): RerankItem[] | null {
  const parseItems = (
    items: unknown,
    scoreKeys: Array<"score" | "relevance_score">,
  ): RerankItem[] | null => {
    if (!Array.isArray(items)) return null;
    const parsed: RerankItem[] = [];
    for (const raw of items as Array<Record<string, unknown>>) {
      const index = typeof raw?.index === "number" ? raw.index : Number(raw?.index);
      if (!Number.isFinite(index)) continue;
      let score: number | null = null;
      for (const key of scoreKeys) {
        const value = raw?.[key];
        const n = typeof value === "number" ? value : Number(value);
        if (Number.isFinite(n)) {
          score = n;
          break;
        }
      }
      if (score === null) continue;
      parsed.push({ index, score });
    }
    return parsed.length > 0 ? parsed : null;
  };

  const objectData =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : undefined;

  switch (provider) {
    case "tei":
      return (
        parseItems(data, ["score", "relevance_score"]) ??
        parseItems(objectData?.results, ["score", "relevance_score"]) ??
        parseItems(objectData?.data, ["score", "relevance_score"])
      );
    case "dashscope": {
      const output = objectData?.output as Record<string, unknown> | undefined;
      if (output) {
        return parseItems(output.results, ["relevance_score", "score"]);
      }
      return parseItems(objectData?.results, ["relevance_score", "score"]);
    }
    case "pinecone":
      return (
        parseItems(objectData?.data, ["score", "relevance_score"]) ??
        parseItems(objectData?.results, ["score", "relevance_score"])
      );
    case "voyage":
      return (
        parseItems(objectData?.data, ["relevance_score", "score"]) ??
        parseItems(objectData?.results, ["relevance_score", "score"])
      );
    case "siliconflow":
    case "jina":
    default:
      return (
        parseItems(objectData?.results, ["relevance_score", "score"]) ??
        parseItems(objectData?.data, ["relevance_score", "score"])
      );
  }
}

// Cosine similarity for reranking fallback
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vector dimensions must match for cosine similarity");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const norm = Math.sqrt(normA) * Math.sqrt(normB);
  return norm === 0 ? 0 : dotProduct / norm;
}

// ============================================================================
// Memory Retriever
// ============================================================================

export class MemoryRetriever {
  private accessTracker: AccessTracker | null = null;

  constructor(
    private store: MemoryStore,
    private embedder: Embedder,
    private config: RetrievalConfig = DEFAULT_RETRIEVAL_CONFIG,
    private decayEngine: DecayEngine | null = null,
  ) {}

  setAccessTracker(tracker: AccessTracker): void {
    this.accessTracker = tracker;
  }

  async retrieve(context: RetrievalContext): Promise<RetrievalResult[]> {
    const { query, limit, scopeFilter, category, source } = context;
    const safeLimit = clampInt(limit, 1, 20);

    let results: RetrievalResult[];
    if (this.config.mode === "vector" || !this.store.hasFtsSupport) {
      results = await this.vectorOnlyRetrieval(query, safeLimit, scopeFilter, category);
    } else {
      results = await this.hybridRetrieval(query, safeLimit, scopeFilter, category);
    }

    // Record access for reinforcement (manual recall only)
    if (this.accessTracker && source === "manual" && results.length > 0) {
      this.accessTracker.recordAccess(results.map((r) => r.entry.id));
    }

    return results;
  }

  private async vectorOnlyRetrieval(
    query: string,
    limit: number,
    scopeFilter?: string[],
    category?: string,
  ): Promise<RetrievalResult[]> {
    const queryVector = await this.embedder.embedQuery(query);
    const results = await this.store.vectorSearch(
      queryVector,
      limit,
      this.config.minScore,
      scopeFilter,
      { excludeInactive: true },
    );

    // Filter by category if specified
    const filtered = category ? results.filter((r) => r.entry.category === category) : results;

    const mapped = filtered.map(
      (result, index) =>
        ({
          ...result,
          sources: {
            vector: { score: result.score, rank: index + 1 },
          },
        }) as RetrievalResult,
    );

    const weighted = this.decayEngine
      ? mapped
      : this.applyImportanceWeight(this.applyRecencyBoost(mapped));
    const lengthNormalized = this.applyLengthNormalization(weighted);
    const hardFiltered = lengthNormalized.filter((r) => r.score >= this.config.hardMinScore);
    const lifecycleRanked = this.decayEngine
      ? this.applyDecayBoost(hardFiltered)
      : this.applyTimeDecay(hardFiltered);
    const denoised = this.config.filterNoise
      ? filterNoise(lifecycleRanked, (r) => r.entry.text)
      : lifecycleRanked;

    // MMR deduplication
    const deduplicated = this.applyMMRDiversity(denoised);

    return deduplicated.slice(0, limit);
  }

  private async hybridRetrieval(
    query: string,
    limit: number,
    scopeFilter?: string[],
    category?: string,
  ): Promise<RetrievalResult[]> {
    const candidatePoolSize = Math.max(this.config.candidatePoolSize, limit * 2);

    // Compute query embedding once, reuse for vector search + reranking
    const queryVector = await this.embedder.embedQuery(query);

    // Run vector and BM25 searches in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      this.runVectorSearch(queryVector, candidatePoolSize, scopeFilter, category),
      this.runBM25Search(query, candidatePoolSize, scopeFilter, category),
    ]);

    // Fuse results using RRF
    const fusedResults = await this.fuseResults(vectorResults, bm25Results);

    // Apply minimum score threshold
    const filtered = fusedResults.filter((r) => r.score >= this.config.minScore);

    // Rerank if enabled
    const reranked =
      this.config.rerank !== "none"
        ? await this.rerankResults(query, queryVector, filtered.slice(0, limit * 2))
        : filtered;

    const temporallyRanked = this.decayEngine
      ? reranked
      : this.applyImportanceWeight(this.applyRecencyBoost(reranked));

    const lengthNormalized = this.applyLengthNormalization(temporallyRanked);
    const hardFiltered = lengthNormalized.filter((r) => r.score >= this.config.hardMinScore);

    const lifecycleRanked = this.decayEngine
      ? this.applyDecayBoost(hardFiltered)
      : this.applyTimeDecay(hardFiltered);

    const denoised = this.config.filterNoise
      ? filterNoise(lifecycleRanked, (r) => r.entry.text)
      : lifecycleRanked;

    const deduplicated = this.applyMMRDiversity(denoised);

    return deduplicated.slice(0, limit);
  }

  private async runVectorSearch(
    queryVector: number[],
    limit: number,
    scopeFilter?: string[],
    category?: string,
  ): Promise<Array<MemorySearchResult & { rank: number }>> {
    const results = await this.store.vectorSearch(queryVector, limit, 0.1, scopeFilter, {
      excludeInactive: true,
    });

    const filtered = category ? results.filter((r) => r.entry.category === category) : results;

    return filtered.map((result, index) => ({
      ...result,
      rank: index + 1,
    }));
  }

  private async runBM25Search(
    query: string,
    limit: number,
    scopeFilter?: string[],
    category?: string,
  ): Promise<Array<MemorySearchResult & { rank: number }>> {
    const results = await this.store.bm25Search(query, limit, scopeFilter, {
      excludeInactive: true,
    });

    const filtered = category ? results.filter((r) => r.entry.category === category) : results;

    return filtered.map((result, index) => ({
      ...result,
      rank: index + 1,
    }));
  }

  private async fuseResults(
    vectorResults: Array<MemorySearchResult & { rank: number }>,
    bm25Results: Array<MemorySearchResult & { rank: number }>,
  ): Promise<RetrievalResult[]> {
    const vectorMap = new Map<string, MemorySearchResult & { rank: number }>();
    const bm25Map = new Map<string, MemorySearchResult & { rank: number }>();

    vectorResults.forEach((result) => {
      vectorMap.set(result.entry.id, result);
    });

    bm25Results.forEach((result) => {
      bm25Map.set(result.entry.id, result);
    });

    const allIds = new Set([...vectorMap.keys(), ...bm25Map.keys()]);

    const fusedResults: RetrievalResult[] = [];

    for (const id of allIds) {
      const vectorResult = vectorMap.get(id);
      const bm25Result = bm25Map.get(id);

      // Validate BM25-only results exist in the store (ghost entry check)
      if (!vectorResult && bm25Result) {
        try {
          const exists = await this.store.hasId(id);
          if (!exists) continue;
        } catch {
          // If hasId fails, keep the result (fail-open)
        }
      }

      const baseResult = vectorResult || bm25Result!;

      const vectorScore = vectorResult ? vectorResult.score : 0;
      const bm25Score = bm25Result ? bm25Result.score : 0;

      const weightedFusion =
        vectorScore * this.config.vectorWeight + bm25Score * this.config.bm25Weight;
      const fusedScore = vectorResult
        ? clamp01(Math.max(weightedFusion, bm25Score >= 0.75 ? bm25Score * 0.92 : 0), 0.1)
        : clamp01(bm25Result!.score, 0.1);

      fusedResults.push({
        entry: baseResult.entry,
        score: fusedScore,
        sources: {
          vector: vectorResult ? { score: vectorResult.score, rank: vectorResult.rank } : undefined,
          bm25: bm25Result ? { score: bm25Result.score, rank: bm25Result.rank } : undefined,
          fused: { score: fusedScore },
        },
      });
    }

    return fusedResults.sort((a, b) => b.score - a.score);
  }

  /**
   * Rerank results using cross-encoder API or cosine similarity fallback.
   */
  private async rerankResults(
    query: string,
    queryVector: number[],
    results: RetrievalResult[],
  ): Promise<RetrievalResult[]> {
    if (results.length === 0) return results;

    // Try cross-encoder rerank via configured provider API
    if (this.config.rerank === "cross-encoder" && this.config.rerankApiKey) {
      try {
        const provider = this.config.rerankProvider || "jina";
        const model = this.config.rerankModel || "jina-reranker-v3";
        const endpoint = this.config.rerankEndpoint || "https://api.jina.ai/v1/rerank";
        const documents = results.map((r) => r.entry.text);

        const { headers, body } = buildRerankRequest(
          provider,
          this.config.rerankApiKey,
          model,
          query,
          documents,
          results.length,
        );

        // Timeout: 5 seconds to prevent stalling retrieval pipeline
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data: unknown = await response.json();
          const parsed = parseRerankResponse(provider, data);

          if (!parsed) {
            console.warn("Rerank API: invalid response shape, falling back to cosine");
          } else {
            const returnedIndices = new Set(parsed.map((r) => r.index));

            const reranked = parsed
              .filter((item) => item.index >= 0 && item.index < results.length)
              .map((item) => {
                const original = results[item.index];
                const floor = this.getRerankPreservationFloor(original, false);
                const blendedScore = clamp01WithFloor(
                  item.score * 0.6 + original.score * 0.4,
                  floor,
                );
                return {
                  ...original,
                  score: blendedScore,
                  sources: {
                    ...original.sources,
                    reranked: { score: item.score },
                  },
                };
              });

            const unreturned = results
              .filter((_, idx) => !returnedIndices.has(idx))
              .map((r) => ({
                ...r,
                score: clamp01WithFloor(r.score * 0.8, this.getRerankPreservationFloor(r, true)),
              }));

            return [...reranked, ...unreturned].sort((a, b) => b.score - a.score);
          }
        } else {
          const errText = await response.text().catch(() => "");
          console.warn(
            `Rerank API returned ${response.status}: ${errText.slice(0, 200)}, falling back to cosine`,
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.warn("Rerank API timed out (5s), falling back to cosine");
        } else {
          console.warn("Rerank API failed, falling back to cosine:", error);
        }
      }
    }

    // Fallback: lightweight cosine similarity rerank
    try {
      const reranked = results.map((result) => {
        const cosineScore = cosineSimilarity(queryVector, result.entry.vector);
        const combinedScore = result.score * 0.7 + cosineScore * 0.3;

        return {
          ...result,
          score: clamp01(combinedScore, result.score),
          sources: {
            ...result.sources,
            reranked: { score: cosineScore },
          },
        };
      });

      return reranked.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.warn("Reranking failed, returning original results:", error);
      return results;
    }
  }

  private getRerankPreservationFloor(result: RetrievalResult, unreturned: boolean): number {
    const bm25Score = result.sources.bm25?.score ?? 0;

    if (bm25Score >= 0.75) {
      return result.score * (unreturned ? 1.0 : 0.95);
    }
    if (bm25Score >= 0.6) {
      return result.score * (unreturned ? 0.95 : 0.9);
    }
    return result.score * (unreturned ? 0.8 : 0.5);
  }

  /**
   * Apply recency boost: newer memories get a small score bonus.
   */
  private applyRecencyBoost(results: RetrievalResult[]): RetrievalResult[] {
    const { recencyHalfLifeDays, recencyWeight } = this.config;
    if (!recencyHalfLifeDays || recencyHalfLifeDays <= 0 || !recencyWeight) {
      return results;
    }

    const now = Date.now();
    const boosted = results.map((r) => {
      const ts = r.entry.timestamp && r.entry.timestamp > 0 ? r.entry.timestamp : now;
      const ageDays = (now - ts) / 86_400_000;
      const boost = Math.exp(-ageDays / recencyHalfLifeDays) * recencyWeight;
      return {
        ...r,
        score: clamp01(r.score + boost, r.score),
      };
    });

    return boosted.sort((a, b) => b.score - a.score);
  }

  /**
   * Apply importance weighting.
   */
  private applyImportanceWeight(results: RetrievalResult[]): RetrievalResult[] {
    const baseWeight = 0.7;
    const weighted = results.map((r) => {
      const importance = r.entry.importance ?? 0.7;
      const factor = baseWeight + (1 - baseWeight) * importance;
      return {
        ...r,
        score: clamp01(r.score * factor, r.score * baseWeight),
      };
    });
    return weighted.sort((a, b) => b.score - a.score);
  }

  private applyDecayBoost(results: RetrievalResult[]): RetrievalResult[] {
    if (!this.decayEngine || results.length === 0) return results;

    const scored = results.map((result) => ({
      memory: toLifecycleMemory(result.entry.id, result.entry),
      score: result.score,
    }));

    this.decayEngine.applySearchBoost(scored);

    const reranked = results.map((result, index) => ({
      ...result,
      score: clamp01(scored[index].score, result.score * 0.3),
    }));

    return reranked.sort((a, b) => b.score - a.score);
  }

  /**
   * Length normalization: penalize long entries that dominate search results.
   */
  private applyLengthNormalization(results: RetrievalResult[]): RetrievalResult[] {
    const anchor = this.config.lengthNormAnchor;
    if (!anchor || anchor <= 0) return results;

    const normalized = results.map((r) => {
      const charLen = r.entry.text.length;
      const ratio = charLen / anchor;
      const logRatio = Math.log2(Math.max(ratio, 1));
      const factor = 1 / (1 + 0.5 * logRatio);
      return {
        ...r,
        score: clamp01(r.score * factor, r.score * 0.3),
      };
    });

    return normalized.sort((a, b) => b.score - a.score);
  }

  /**
   * Time decay: multiplicative penalty for old entries.
   */
  private applyTimeDecay(results: RetrievalResult[]): RetrievalResult[] {
    const halfLife = this.config.timeDecayHalfLifeDays;
    if (!halfLife || halfLife <= 0) return results;

    const now = Date.now();
    const decayed = results.map((r) => {
      const ts = r.entry.timestamp && r.entry.timestamp > 0 ? r.entry.timestamp : now;
      const ageDays = (now - ts) / 86_400_000;

      // Access reinforcement: frequently recalled memories decay slower
      const { accessCount, lastAccessedAt } = parseAccessMetadata(r.entry.metadata);
      const effectiveHL = computeEffectiveHalfLife(
        halfLife,
        accessCount,
        lastAccessedAt,
        this.config.reinforcementFactor,
        this.config.maxHalfLifeMultiplier,
      );

      // floor at 0.5: even very old entries keep at least 50% of their score
      const factor = 0.5 + 0.5 * Math.exp(-ageDays / effectiveHL);
      return {
        ...r,
        score: clamp01(r.score * factor, r.score * 0.5),
      };
    });

    return decayed.sort((a, b) => b.score - a.score);
  }

  /**
   * MMR-inspired diversity filter: greedily select results that are both
   * relevant (high score) and diverse (low similarity to already-selected).
   */
  private applyMMRDiversity(
    results: RetrievalResult[],
    similarityThreshold = 0.85,
  ): RetrievalResult[] {
    if (results.length <= 1) return results;

    const selected: RetrievalResult[] = [];
    const deferred: RetrievalResult[] = [];

    for (const candidate of results) {
      const tooSimilar = selected.some((s) => {
        const sVec = s.entry.vector;
        const cVec = candidate.entry.vector;
        if (!sVec?.length || !cVec?.length) return false;
        const sArr = Array.from(sVec as Iterable<number>);
        const cArr = Array.from(cVec as Iterable<number>);
        const sim = cosineSimilarity(sArr, cArr);
        return sim > similarityThreshold;
      });

      if (tooSimilar) {
        deferred.push(candidate);
      } else {
        selected.push(candidate);
      }
    }
    return [...selected, ...deferred];
  }

  // Update configuration
  updateConfig(newConfig: Partial<RetrievalConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current configuration
  getConfig(): RetrievalConfig {
    return { ...this.config };
  }

  // Test retrieval system
  async test(query = "test query"): Promise<{
    success: boolean;
    mode: string;
    hasFtsSupport: boolean;
    error?: string;
  }> {
    try {
      await this.retrieve({ query, limit: 1 });

      return {
        success: true,
        mode: this.config.mode,
        hasFtsSupport: this.store.hasFtsSupport,
      };
    } catch (error) {
      return {
        success: false,
        mode: this.config.mode,
        hasFtsSupport: this.store.hasFtsSupport,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRetriever(
  store: MemoryStore,
  embedder: Embedder,
  config?: Partial<RetrievalConfig>,
  options?: { decayEngine?: DecayEngine | null },
): MemoryRetriever {
  const fullConfig = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };
  return new MemoryRetriever(store, embedder, fullConfig, options?.decayEngine ?? null);
}
