/**
 * Smart Metadata Type Stubs (P3)
 *
 * Lightweight stubs for the SmartMetadata module.
 * Full implementation will come in the P3 lifecycle phase.
 * These stubs provide pass-through behavior so the retriever can function
 * without the full lifecycle system.
 */

import type { DecayableMemory, MemoryTier } from "./decay-engine-types.js";

// Minimal SmartMemoryMetadata for P1 stub usage
export interface SmartMemoryMetadata {
  valid_from: number;
  invalidated_at?: number;
  access_count: number;
  last_accessed_at: number;
  tier: MemoryTier;
  confidence: number;
  [key: string]: unknown;
}

/**
 * Parse smart metadata from a raw JSON string.
 * P1 stub: returns a minimal metadata object with defaults.
 */
export function parseSmartMetadata(
  raw: string | undefined,
  entry?: { timestamp?: number; importance?: number; text?: string; category?: string },
): SmartMemoryMetadata {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        parsed = obj as Record<string, unknown>;
      }
    } catch {
      parsed = {};
    }
  }

  const timestamp =
    entry && typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
      ? entry.timestamp
      : Date.now();

  return {
    valid_from: typeof parsed.valid_from === "number" ? parsed.valid_from : timestamp,
    invalidated_at: typeof parsed.invalidated_at === "number" ? parsed.invalidated_at : undefined,
    access_count: typeof parsed.access_count === "number" ? parsed.access_count : 0,
    last_accessed_at:
      typeof parsed.last_accessed_at === "number" ? parsed.last_accessed_at : timestamp,
    tier:
      parsed.tier === "core" || parsed.tier === "working" || parsed.tier === "peripheral"
        ? (parsed.tier as MemoryTier)
        : "working",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
    ...parsed,
  };
}

/**
 * Check if a memory is active at a given time.
 * P1 stub: all memories are considered active (returns true).
 */
export function isMemoryActiveAt(
  metadata: Pick<SmartMemoryMetadata, "valid_from" | "invalidated_at">,
  at = Date.now(),
): boolean {
  if (metadata.valid_from > at) return false;
  return !metadata.invalidated_at || metadata.invalidated_at > at;
}

/**
 * Extract a DecayableMemory from a store entry.
 * P1 stub: returns basic decay-compatible fields.
 */
export function getDecayableFromEntry(entry: {
  id?: string;
  importance?: number;
  timestamp?: number;
  metadata?: string;
}): {
  memory: DecayableMemory;
  meta: SmartMemoryMetadata;
} {
  const meta = parseSmartMetadata(entry.metadata, entry as { timestamp?: number });
  const createdAt =
    typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
      ? entry.timestamp
      : Date.now();

  const memory: DecayableMemory = {
    id: entry.id ?? "",
    importance:
      typeof entry.importance === "number" && Number.isFinite(entry.importance)
        ? entry.importance
        : 0.7,
    confidence: meta.confidence,
    tier: meta.tier,
    accessCount: meta.access_count,
    createdAt,
    lastAccessedAt: meta.last_accessed_at || createdAt,
  };

  return { memory, meta };
}

/**
 * Convert a store entry to a LifecycleMemory.
 * P1 stub: returns the same shape as vendor smart-metadata.
 */
export function toLifecycleMemory(
  id: string,
  entry: { importance?: number; timestamp?: number; metadata?: string },
): DecayableMemory {
  const meta = parseSmartMetadata(entry.metadata, entry as { timestamp?: number });
  const createdAt =
    typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
      ? entry.timestamp
      : Date.now();

  return {
    id,
    importance:
      typeof entry.importance === "number" && Number.isFinite(entry.importance)
        ? entry.importance
        : 0.7,
    confidence: meta.confidence,
    tier: meta.tier,
    accessCount: meta.access_count,
    createdAt,
    lastAccessedAt: meta.last_accessed_at || createdAt,
  };
}
