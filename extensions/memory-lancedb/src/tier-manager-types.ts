/**
 * Tier Manager Type Stubs (P3)
 *
 * Lightweight interface stubs for the TierManager module.
 * Full implementation will come in the P3 lifecycle phase.
 */

import type { DecayScore, DecayableMemory, MemoryTier } from "./decay-engine-types.js";

export interface TierTransition {
  memoryId: string;
  fromTier: MemoryTier;
  toTier: MemoryTier;
}

export interface TierManager {
  /** Evaluate whether a memory should transition tiers. Returns null if no transition. */
  evaluate(memory: DecayableMemory, decayScore: DecayScore, nowMs?: number): TierTransition | null;
  /** Get the tier for a memory based on importance and access count. */
  getTier(memory: { importance?: number; accessCount?: number }): MemoryTier;
}
