/**
 * JsonStore — typed JSON file persistence with in-memory caching.
 *
 * Replaces SQLite for small configuration datasets. Design principles:
 *   - **Single writer**: memory is the sole source of truth; disk is a durable mirror.
 *   - **Atomic writes**: writeFileSync(tmp) + renameSync prevents partial writes.
 *   - **Corruption resilience**: JSON.parse failure → return default + console.warn.
 *   - **HMR safe**: globalThis singleton per store name survives Next.js hot reloads.
 *
 * Storage directory: `~/.openclaw/openclaw-deck/`.
 */
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DIR = ".openclaw/openclaw-deck";
const GLOBAL_PREFIX = "__oclJsonStore__";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveStorageDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return process.env.DECK_DATA_DIR ?? path.join(home, DEFAULT_DIR);
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// JsonStore
// ---------------------------------------------------------------------------

export class JsonStore<T> {
  private data: T;
  private readonly filePath: string;
  constructor(
    private readonly name: string,
    private readonly defaultValue: T,
    fileName?: string,
  ) {
    const dir = resolveStorageDir();
    ensureDir(dir);
    this.filePath = path.join(dir, fileName ?? `${name}.json`);
    this.data = this.loadFromDisk();
  }

  // -- Read -----------------------------------------------------------------

  /** Return the full stored value (by reference — callers should not mutate directly). */
  get(): T {
    return this.data;
  }

  // -- Write ----------------------------------------------------------------

  /** Replace the entire stored value and persist to disk. */
  set(value: T): void {
    this.data = value;
    this.saveToDisk();
  }

  /**
   * Apply a partial update (shallow merge for objects, full replace for arrays/primitives)
   * and persist to disk.
   */
  update(updater: (current: T) => T): void {
    this.data = updater(this.data);
    this.saveToDisk();
  }

  // -- Array helpers (when T extends unknown[]) ------------------------------

  /** Append an item to an array store and persist. */
  append(item: T extends Array<infer U> ? U : never): void {
    if (!Array.isArray(this.data)) {
      throw new Error(`[JsonStore:${this.name}] append() requires an array store`);
    }
    (this.data as unknown[]).push(item);
    this.saveToDisk();
  }

  /** Remove items matching a predicate and persist. Returns removed count. */
  removeWhere(predicate: (item: T extends Array<infer U> ? U : never) => boolean): number {
    if (!Array.isArray(this.data)) {
      throw new Error(`[JsonStore:${this.name}] removeWhere() requires an array store`);
    }
    const arr = this.data as unknown[];
    const before = arr.length;
    this.data = arr.filter((item) => !predicate(item as never)) as unknown as T;
    const removed = before - (this.data as unknown as unknown[]).length;
    if (removed > 0) {
      this.saveToDisk();
    }
    return removed;
  }

  /** Find a single item in an array store. */
  find(
    predicate: (item: T extends Array<infer U> ? U : never) => boolean,
  ): (T extends Array<infer U> ? U : never) | undefined {
    if (!Array.isArray(this.data)) {
      return undefined;
    }
    return (this.data as unknown[]).find((item) => predicate(item as never)) as
      | (T extends Array<infer U> ? U : never)
      | undefined;
  }

  /** Update a single item in an array store by predicate. Returns true if found. */
  updateItem(
    predicate: (item: T extends Array<infer U> ? U : never) => boolean,
    updater: (item: T extends Array<infer U> ? U : never) => T extends Array<infer U> ? U : never,
  ): boolean {
    if (!Array.isArray(this.data)) {
      return false;
    }
    const arr = this.data as unknown[];
    const idx = arr.findIndex((item) => predicate(item as never));
    if (idx < 0) {
      return false;
    }
    arr[idx] = updater(arr[idx] as never);
    this.saveToDisk();
    return true;
  }

  /**
   * Truncate an array store to keep only the last `maxItems` entries.
   * Useful for capped logs like webhook deliveries.
   */
  truncate(maxItems: number): void {
    if (!Array.isArray(this.data)) {
      return;
    }
    const arr = this.data as unknown[];
    if (arr.length > maxItems) {
      this.data = arr.slice(-maxItems) as unknown as T;
      this.saveToDisk();
    }
  }

  // -- Disk I/O -------------------------------------------------------------

  /** Reload data from disk (useful for tests or manual recovery). */
  reload(): void {
    this.data = this.loadFromDisk();
  }

  /** Return the resolved file path (useful for diagnostics). */
  getFilePath(): string {
    return this.filePath;
  }

  /** Check if the backing file exists on disk. */
  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  // -- Internal -------------------------------------------------------------

  private loadFromDisk(): T {
    try {
      if (!fs.existsSync(this.filePath)) {
        return structuredClone(this.defaultValue);
      }
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(
        `[JsonStore:${this.name}] Failed to load ${this.filePath}, using default:`,
        err instanceof Error ? err.message : err,
      );
      return structuredClone(this.defaultValue);
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.filePath);
      ensureDir(dir);
      const tmp = this.filePath + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf-8");
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.error(
        `[JsonStore:${this.name}] Failed to save ${this.filePath}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// globalThis singleton factory (HMR-safe)
// ---------------------------------------------------------------------------

/**
 * Get or create a named JsonStore singleton.
 * Survives Next.js HMR reloads via globalThis caching.
 */
export function getJsonStore<T>(name: string, defaultValue: T, fileName?: string): JsonStore<T> {
  const key = `${GLOBAL_PREFIX}${name}`;
  const g = globalThis as unknown as Record<string, JsonStore<T> | undefined>;
  if (!g[key]) {
    g[key] = new JsonStore(name, defaultValue, fileName);
  }
  return g[key];
}
