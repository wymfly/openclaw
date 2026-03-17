import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createReqIdStore, type ReqIdStore } from "./reqid-store.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("reqid-store", () => {
  let tmpDir: string;
  let store: ReqIdStore;

  beforeEach(async () => {
    tmpDir = path.join(
      os.tmpdir(),
      `reqid-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    store?.destroy();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("set and getSync", () => {
    it("stores and retrieves a reqId by chatId", () => {
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1" });
      store.set("chat1", "req-abc");
      expect(store.getSync("chat1")).toBe("req-abc");
    });

    it("returns undefined for unknown chatId", () => {
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1" });
      expect(store.getSync("unknown")).toBeUndefined();
    });

    it("overwrites existing entry", () => {
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1" });
      store.set("chat1", "req-1");
      store.set("chat1", "req-2");
      expect(store.getSync("chat1")).toBe("req-2");
    });
  });

  describe("has", () => {
    it("returns true if reqId matches current entry", () => {
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1" });
      store.set("chat1", "req-abc");
      expect(store.has("chat1", "req-abc")).toBe(true);
    });

    it("returns false if reqId does not match", () => {
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1" });
      store.set("chat1", "req-abc");
      expect(store.has("chat1", "req-different")).toBe(false);
    });

    it("returns false for unknown chatId", () => {
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1" });
      expect(store.has("unknown", "any")).toBe(false);
    });
  });

  describe("7-day TTL expiration", () => {
    it("expires entries older than 7 days", () => {
      const ttlMs = 7 * DAY_MS;
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1", ttlMs });

      // Manually inject an old entry via set, then mock Date.now
      const originalNow = Date.now;
      const baseTime = originalNow();
      vi.spyOn(Date, "now").mockReturnValue(baseTime);
      store.set("chat1", "req-old");

      // Advance time past TTL
      vi.spyOn(Date, "now").mockReturnValue(baseTime + ttlMs + 1);
      expect(store.getSync("chat1")).toBeUndefined();
      expect(store.has("chat1", "req-old")).toBe(false);

      vi.restoreAllMocks();
    });

    it("keeps entries within TTL", () => {
      const ttlMs = 7 * DAY_MS;
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1", ttlMs });

      const originalNow = Date.now;
      const baseTime = originalNow();
      vi.spyOn(Date, "now").mockReturnValue(baseTime);
      store.set("chat1", "req-fresh");

      // Just before TTL expires
      vi.spyOn(Date, "now").mockReturnValue(baseTime + ttlMs - 1);
      expect(store.getSync("chat1")).toBe("req-fresh");

      vi.restoreAllMocks();
    });
  });

  describe("200-entry max eviction", () => {
    it("evicts oldest entries when exceeding maxSize", () => {
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1", maxSize: 5 });
      for (let i = 0; i < 7; i++) {
        store.set(`chat-${i}`, `req-${i}`);
      }
      expect(store.size).toBe(5);
      // Oldest entries (chat-0, chat-1) should be evicted
      expect(store.getSync("chat-0")).toBeUndefined();
      expect(store.getSync("chat-1")).toBeUndefined();
      // Newest should remain
      expect(store.getSync("chat-6")).toBe("req-6");
    });
  });

  describe("flush and persistence", () => {
    it("flushes to disk", async () => {
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1", debounceMs: 50 });
      store.set("chat1", "req-abc");
      await store.flush();

      const filePath = path.join(tmpDir, "wecomConfig", "reqids-a1.json");
      const data = JSON.parse(await readFile(filePath, "utf8"));
      expect(data.chat1.reqId).toBe("req-abc");
    });

    it("debounced flush writes to disk after delay", async () => {
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1", debounceMs: 50 });
      store.set("chat1", "req-debounced");

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 150));

      const filePath = path.join(tmpDir, "wecomConfig", "reqids-a1.json");
      const data = JSON.parse(await readFile(filePath, "utf8"));
      expect(data.chat1.reqId).toBe("req-debounced");
    });
  });

  describe("warmup (persistence across reload)", () => {
    it("loads entries from disk on warmup", async () => {
      // Write data with first store
      const store1 = createReqIdStore({ storeDir: tmpDir, accountId: "a1" });
      store1.set("chat1", "req-persisted");
      await store1.flush();
      store1.destroy();

      // Create new store and warmup
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1" });
      expect(store.getSync("chat1")).toBeUndefined(); // Not loaded yet
      await store.warmup();
      expect(store.getSync("chat1")).toBe("req-persisted");
    });

    it("skips expired entries during warmup", async () => {
      const ttlMs = 1000;
      const store1 = createReqIdStore({ storeDir: tmpDir, accountId: "a1", ttlMs });

      const baseTime = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(baseTime);
      store1.set("chat1", "req-expired");
      await store1.flush();
      store1.destroy();

      // Advance past TTL
      vi.spyOn(Date, "now").mockReturnValue(baseTime + ttlMs + 100);
      store = createReqIdStore({ storeDir: tmpDir, accountId: "a1", ttlMs });
      await store.warmup();
      expect(store.getSync("chat1")).toBeUndefined();
      expect(store.size).toBe(0);

      vi.restoreAllMocks();
    });
  });
});
