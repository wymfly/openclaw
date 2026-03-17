/**
 * Smart Metadata Type Re-exports
 *
 * This file originally contained P1 stubs. Now that the full smart-metadata
 * module is transplanted, it re-exports everything so existing imports
 * (e.g. retriever.ts) continue to work without path changes.
 */

export {
  parseSmartMetadata,
  isMemoryActiveAt,
  getDecayableFromEntry,
  toLifecycleMemory,
  type SmartMemoryMetadata,
  type LifecycleMemory,
} from "./smart-metadata.js";
