/**
 * Decay Engine Types — re-exports from canonical sources
 *
 * MemoryTier is canonically defined in memory-categories.ts.
 * DecayableMemory, DecayScore, DecayEngine are canonically defined in decay-engine.ts.
 * This file re-exports them for backward compatibility with existing imports.
 */

export type { MemoryTier } from "./memory-categories.js";

export type { DecayableMemory, DecayScore, DecayEngine } from "./decay-engine.js";
