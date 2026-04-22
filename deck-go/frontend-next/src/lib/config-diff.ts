/**
 * Config diff utilities for structured field-level diffing,
 * change classification, and JSON Merge Patch (RFC 7396) generation.
 */

export interface DiffEntry {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  type: "add" | "change" | "remove";
}

/** Returns true when val is a plain (non-array) object. */
function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

/**
 * Recursively compute a flat list of field-level differences between two configs.
 *
 * Rules:
 * - Both arrays  → treated as leaf nodes; compared with JSON.stringify
 * - Both objects → recurse into keys (union of old + new keys)
 * - Otherwise    → compare with !==
 */
export function computeConfigDiff(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
): DiffEntry[] {
  const results: DiffEntry[] = [];
  diffRecurse(oldConfig, newConfig, "", results);
  return results;
}

function diffRecurse(oldVal: unknown, newVal: unknown, prefix: string, results: DiffEntry[]): void {
  // Both arrays → leaf comparison
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      results.push({ path: prefix, oldValue: oldVal, newValue: newVal, type: "change" });
    }
    return;
  }

  // Both plain objects → recurse
  if (isPlainObject(oldVal) && isPlainObject(newVal)) {
    const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
    for (const key of keys) {
      const childPath = prefix ? `${prefix}.${key}` : key;
      const hasOld = Object.prototype.hasOwnProperty.call(oldVal, key);
      const hasNew = Object.prototype.hasOwnProperty.call(newVal, key);

      if (!hasOld) {
        // New key added — recurse so nested objects are flattened to leaves
        collectAdded(newVal[key], childPath, results);
      } else if (!hasNew) {
        // Key removed — recurse to flatten nested removes
        collectRemoved(oldVal[key], childPath, results);
      } else {
        diffRecurse(oldVal[key], newVal[key], childPath, results);
      }
    }
    return;
  }

  // Leaf comparison (one or both are non-object / mixed types / primitives)
  const oldIsAbsent = oldVal === undefined;
  const newIsAbsent = newVal === undefined;

  if (oldIsAbsent && !newIsAbsent) {
    results.push({ path: prefix, oldValue: undefined, newValue: newVal, type: "add" });
  } else if (!oldIsAbsent && newIsAbsent) {
    results.push({ path: prefix, oldValue: oldVal, newValue: undefined, type: "remove" });
  } else if (oldVal !== newVal) {
    results.push({ path: prefix, oldValue: oldVal, newValue: newVal, type: "change" });
  }
}

/** Emit "add" entries for every leaf under a newly-added value. */
function collectAdded(val: unknown, path: string, results: DiffEntry[]): void {
  if (isPlainObject(val)) {
    for (const key of Object.keys(val)) {
      collectAdded(val[key], `${path}.${key}`, results);
    }
  } else {
    results.push({ path, oldValue: undefined, newValue: val, type: "add" });
  }
}

/** Emit "remove" entries for every leaf under a removed value. */
function collectRemoved(val: unknown, path: string, results: DiffEntry[]): void {
  if (isPlainObject(val)) {
    for (const key of Object.keys(val)) {
      collectRemoved(val[key], `${path}.${key}`, results);
    }
  } else {
    results.push({ path, oldValue: val, newValue: undefined, type: "remove" });
  }
}

// ---------------------------------------------------------------------------
// classifyChanges
// ---------------------------------------------------------------------------

/**
 * Classify the mutation type between two configs.
 *
 * - `"apply-required"` when any array value changed (content or length).
 * - `"patch-safe"` for scalar-only mutations or no changes.
 */
export function classifyChanges(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
): "patch-safe" | "apply-required" {
  return hasArrayMutation(oldConfig, newConfig) ? "apply-required" : "patch-safe";
}

function hasArrayMutation(oldVal: unknown, newVal: unknown): boolean {
  // Both arrays → compare content
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
  }

  // One side is array but not the other — structural change
  if (Array.isArray(oldVal) || Array.isArray(newVal)) {
    return true;
  }

  // Both plain objects → recurse
  if (isPlainObject(oldVal) && isPlainObject(newVal)) {
    const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
    for (const key of keys) {
      if (hasArrayMutation(oldVal[key], newVal[key])) {
        return true;
      }
    }
    return false;
  }

  // Scalars or type mismatches — not an array mutation
  return false;
}

// ---------------------------------------------------------------------------
// computeMergePatch
// ---------------------------------------------------------------------------

/**
 * Compute a JSON Merge Patch (RFC 7396) from oldConfig → newConfig.
 *
 * - Changed / added keys appear with their new values.
 * - Removed keys appear set to `null` (RFC 7396 delete semantic).
 * - Recurses into nested plain objects.
 * - Arrays are treated as atomic values.
 */
export function computeMergePatch(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
): Record<string, unknown> {
  return mergePatchRecurse(oldConfig, newConfig);
}

function mergePatchRecurse(
  oldVal: Record<string, unknown>,
  newVal: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);

  for (const key of allKeys) {
    const hasOld = Object.prototype.hasOwnProperty.call(oldVal, key);
    const hasNew = Object.prototype.hasOwnProperty.call(newVal, key);

    if (!hasOld) {
      // Added key
      patch[key] = newVal[key];
    } else if (!hasNew) {
      // Removed key → null per RFC 7396
      patch[key] = null;
    } else {
      const ov = oldVal[key];
      const nv = newVal[key];

      // Recurse into nested plain objects (arrays are atomic)
      if (isPlainObject(ov) && isPlainObject(nv)) {
        const nestedPatch = mergePatchRecurse(ov, nv);
        if (Object.keys(nestedPatch).length > 0) {
          patch[key] = nestedPatch;
        }
      } else if (JSON.stringify(ov) !== JSON.stringify(nv)) {
        patch[key] = nv;
      }
      // else: no change for this key, omit from patch
    }
  }

  return patch;
}
