export interface DiffEntry {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  type: "add" | "change" | "remove";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function computeConfigDiff(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
): DiffEntry[] {
  const results: DiffEntry[] = [];
  diffRecurse(oldConfig, newConfig, "", results);
  return results;
}

function diffRecurse(oldValue: unknown, newValue: unknown, path: string, results: DiffEntry[]) {
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      results.push({ path, oldValue, newValue, type: "change" });
    }
    return;
  }

  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      const hasOld = Object.prototype.hasOwnProperty.call(oldValue, key);
      const hasNew = Object.prototype.hasOwnProperty.call(newValue, key);
      if (!hasOld) {
        collectAdded(newValue[key], childPath, results);
      } else if (!hasNew) {
        collectRemoved(oldValue[key], childPath, results);
      } else {
        diffRecurse(oldValue[key], newValue[key], childPath, results);
      }
    }
    return;
  }

  const oldIsAbsent = oldValue === undefined;
  const newIsAbsent = newValue === undefined;
  if (oldIsAbsent && !newIsAbsent) {
    results.push({ path, oldValue: undefined, newValue, type: "add" });
  } else if (!oldIsAbsent && newIsAbsent) {
    results.push({ path, oldValue, newValue: undefined, type: "remove" });
  } else if (oldValue !== newValue) {
    results.push({ path, oldValue, newValue, type: "change" });
  }
}

function collectAdded(value: unknown, path: string, results: DiffEntry[]) {
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      collectAdded(value[key], `${path}.${key}`, results);
    }
    return;
  }
  results.push({ path, oldValue: undefined, newValue: value, type: "add" });
}

function collectRemoved(value: unknown, path: string, results: DiffEntry[]) {
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      collectRemoved(value[key], `${path}.${key}`, results);
    }
    return;
  }
  results.push({ path, oldValue: value, newValue: undefined, type: "remove" });
}

export function classifyChanges(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
): "patch-safe" | "apply-required" {
  return hasArrayMutation(oldConfig, newConfig) ? "apply-required" : "patch-safe";
}

function hasArrayMutation(oldValue: unknown, newValue: unknown): boolean {
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    return JSON.stringify(oldValue) !== JSON.stringify(newValue);
  }
  if (Array.isArray(oldValue) || Array.isArray(newValue)) {
    return true;
  }
  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    for (const key of keys) {
      if (hasArrayMutation(oldValue[key], newValue[key])) {
        return true;
      }
    }
  }
  return false;
}

export function computeMergePatch(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
): Record<string, unknown> {
  return mergePatchRecurse(oldConfig, newConfig);
}

function mergePatchRecurse(
  oldValue: Record<string, unknown>,
  newValue: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);

  for (const key of keys) {
    const hasOld = Object.prototype.hasOwnProperty.call(oldValue, key);
    const hasNew = Object.prototype.hasOwnProperty.call(newValue, key);
    if (!hasOld) {
      patch[key] = newValue[key];
    } else if (!hasNew) {
      patch[key] = null;
    } else {
      const oldField = oldValue[key];
      const newField = newValue[key];
      if (isPlainObject(oldField) && isPlainObject(newField)) {
        const nestedPatch = mergePatchRecurse(oldField, newField);
        if (Object.keys(nestedPatch).length > 0) {
          patch[key] = nestedPatch;
        }
      } else if (JSON.stringify(oldField) !== JSON.stringify(newField)) {
        patch[key] = newField;
      }
    }
  }

  return patch;
}
