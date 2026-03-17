/**
 * Persistent message deduplication store — TypeScript port of @sunnoy/wecom reqid-store.js.
 *
 * Tracks the last-seen reqId per chatId so duplicate inbound frames (e.g. after
 * reconnect) can be rejected. Entries persist to disk via debounced atomic writes.
 *
 * Differences from vendor:
 * - `storeDir` is injected (no hardcoded resolveStateDir)
 * - Zero external dependencies
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// ── Defaults ──

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_MAX_SIZE = 200;
const DEFAULT_DEBOUNCE_MS = 1_000;

// ── Types ──

interface StoreEntry {
  reqId: string;
  updatedAt: number;
}

export interface ReqIdStore {
  /** Record a reqId for a chatId. Triggers debounced flush. */
  set(chatId: string, reqId: string): void;
  /** Synchronously retrieve the current reqId for a chatId (returns undefined if expired or missing). */
  getSync(chatId: string): string | undefined;
  /** Check if a specific reqId matches the current entry for a chatId. */
  has(chatId: string, reqId: string): boolean;
  /** Load persisted entries from disk (call once on startup). */
  warmup(): Promise<void>;
  /** Write current state to disk immediately. */
  flush(): Promise<void>;
  /** Cancel pending debounced flush timer. */
  destroy(): void;
  /** Current number of entries in cache. */
  readonly size: number;
}

export interface ReqIdStoreOptions {
  storeDir: string;
  accountId: string;
  maxSize?: number;
  ttlMs?: number;
  debounceMs?: number;
}

// ── Helpers ──

function getStorePath(storeDir: string, accountId: string): string {
  return path.join(storeDir, "wecomConfig", `reqids-${accountId}.json`);
}

async function readJsonFile(filePath: string): Promise<Record<string, StoreEntry>> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return {};
    throw error;
  }
}

async function writeJsonFileAtomically(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

// ── Factory ──

export function createReqIdStore(options: ReqIdStoreOptions): ReqIdStore {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const storePath = getStorePath(options.storeDir, options.accountId);

  const cache = new Map<string, StoreEntry>();
  let dirty = false;
  let dirtyVersion = 0;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushPromise: Promise<void> | null = null;

  function evictOldest(): void {
    if (cache.size <= maxSize) return;
    const entries = [...cache.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    const toRemove = entries.length - maxSize;
    for (let i = 0; i < toRemove; i++) {
      cache.delete(entries[i][0]);
    }
  }

  function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      try {
        await store.flush();
      } catch {
        // flush logs internally; swallow here
      }
    }, debounceMs);
  }

  const store: ReqIdStore = {
    set(chatId, reqId) {
      cache.set(chatId, { reqId, updatedAt: Date.now() });
      dirty = true;
      dirtyVersion += 1;
      evictOldest();
      scheduleFlush();
    },

    getSync(chatId) {
      const entry = cache.get(chatId);
      if (!entry) return undefined;
      if (Date.now() - entry.updatedAt > ttlMs) {
        cache.delete(chatId);
        return undefined;
      }
      return entry.reqId;
    },

    has(chatId, reqId) {
      const current = this.getSync(chatId);
      return current === reqId;
    },

    async warmup() {
      try {
        const data = await readJsonFile(storePath);
        const now = Date.now();
        for (const [chatId, entry] of Object.entries(data)) {
          if (entry?.reqId && entry?.updatedAt && now - entry.updatedAt <= ttlMs) {
            cache.set(chatId, entry);
          }
        }
        evictOldest();
      } catch {
        // warmup is non-fatal
      }
    },

    async flush() {
      if (flushPromise) {
        await flushPromise;
        if (!dirty) return;
      }
      if (!dirty) return;

      const currentFlush = (async () => {
        const snapshot = Object.fromEntries(cache);
        const snapshotVersion = dirtyVersion;
        try {
          await writeJsonFileAtomically(storePath, snapshot);
          if (dirtyVersion === snapshotVersion) {
            dirty = false;
          } else {
            scheduleFlush();
          }
        } catch {
          // Keep dirty=true so next flush retries
          scheduleFlush();
        }
      })();
      flushPromise = currentFlush;
      try {
        await currentFlush;
      } finally {
        if (flushPromise === currentFlush) {
          flushPromise = null;
        }
      }
    },

    destroy() {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    },

    get size() {
      return cache.size;
    },
  };

  return store;
}
