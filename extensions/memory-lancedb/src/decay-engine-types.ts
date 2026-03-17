/**
 * Decay Engine Type Stubs (P3)
 *
 * Lightweight interface stubs for the DecayEngine module.
 * Full implementation will come in the P3 lifecycle phase.
 */

export type MemoryTier = "core" | "working" | "peripheral";

export interface DecayableMemory {
  id: string;
  importance: number;
  confidence: number;
  tier: MemoryTier;
  accessCount: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface DecayScore {
  composite: number;
  recency: number;
  frequency: number;
  intrinsic: number;
}

export interface DecayEngine {
  /** Compute composite decay score for a memory at a given time. */
  score(memory: DecayableMemory, nowMs?: number): DecayScore;
  /** Apply search-time boost/penalty to scored results in-place. */
  applySearchBoost(scored: Array<{ memory: DecayableMemory; score: number }>, nowMs?: number): void;
}
