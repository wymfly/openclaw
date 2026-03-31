import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { openDb, preloadSqlJs } from "../db.js";
import type { Database } from "../db.js";
import { ProjectionStore } from "../projection-store.js";

beforeAll(async () => {
  await preloadSqlJs();
});

// ---------------------------------------------------------------------------
// Setup — each test gets a fresh in-memory database
// ---------------------------------------------------------------------------

let db: Database;
let store: ProjectionStore;

beforeEach(() => {
  db = openDb(":memory:");
  store = new ProjectionStore(db);
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // already closed
  }
});

// ---------------------------------------------------------------------------
// appendEvent
// ---------------------------------------------------------------------------

describe("appendEvent", () => {
  it("writes to outbox and returns a positive ID", () => {
    const id = store.appendEvent("chat.delta", { token: "hi" });
    expect(id).toBeGreaterThan(0);
  });

  it("returns monotonically increasing IDs", () => {
    const id1 = store.appendEvent("chat.delta", { token: "a" });
    const id2 = store.appendEvent("chat.delta", { token: "b" });
    const id3 = store.appendEvent("chat.final", { text: "c" });

    expect(id2).toBeGreaterThan(id1);
    expect(id3).toBeGreaterThan(id2);
  });

  it("persists serialised JSON payload", () => {
    const payload = { nested: { key: "value" }, num: 42 };
    store.appendEvent("gateway.event", payload);

    const row = db.prepare("SELECT payload FROM outbox WHERE id = 1").get() as { payload: string };

    expect(JSON.parse(row.payload)).toEqual(payload);
  });
});

// ---------------------------------------------------------------------------
// getEventsSince
// ---------------------------------------------------------------------------

describe("getEventsSince", () => {
  it("returns events after a given ID", () => {
    store.appendEvent("chat.delta", "a");
    store.appendEvent("chat.delta", "b");
    store.appendEvent("chat.final", "c");

    const events = store.getEventsSince(1);
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe(2);
    expect(events[1].id).toBe(3);
  });

  it("returns all events when lastId is 0", () => {
    store.appendEvent("chat.delta", "a");
    store.appendEvent("chat.delta", "b");

    const events = store.getEventsSince(0);
    expect(events).toHaveLength(2);
  });

  it("returns empty array when no events match", () => {
    store.appendEvent("chat.delta", "a");
    expect(store.getEventsSince(999)).toHaveLength(0);
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      store.appendEvent("chat.delta", i);
    }

    const events = store.getEventsSince(0, 3);
    expect(events).toHaveLength(3);
    expect(events[0].id).toBe(1);
    expect(events[2].id).toBe(3);
  });

  it("deserialises payload correctly", () => {
    const payload = { message: "hello", count: 7 };
    store.appendEvent("chat.delta", payload);

    const events = store.getEventsSince(0);
    expect(events[0].payload).toEqual(payload);
    expect(events[0].eventType).toBe("chat.delta");
    expect(events[0].createdAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// outboxHead
// ---------------------------------------------------------------------------

describe("outboxHead", () => {
  it("returns 0 for empty outbox", () => {
    expect(store.outboxHead()).toBe(0);
  });

  it("returns the highest ID after inserts", () => {
    store.appendEvent("a", 1);
    store.appendEvent("b", 2);
    store.appendEvent("c", 3);

    expect(store.outboxHead()).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// settings CRUD
// ---------------------------------------------------------------------------

describe("settings", () => {
  it("returns undefined for missing key", () => {
    expect(store.getSetting("nonexistent")).toBeUndefined();
  });

  it("stores and retrieves a value", () => {
    store.setSetting("theme", "dark");
    expect(store.getSetting("theme")).toBe("dark");
  });

  it("overwrites existing value (upsert)", () => {
    store.setSetting("lang", "en");
    store.setSetting("lang", "zh-CN");
    expect(store.getSetting("lang")).toBe("zh-CN");
  });

  it("handles JSON string values", () => {
    const json = JSON.stringify({ gateway: { url: "ws://localhost" } });
    store.setSetting("config", json);
    expect(store.getSetting("config")).toBe(json);
  });

  it("deleteSetting removes the key", () => {
    store.setSetting("temp", "val");
    expect(store.deleteSetting("temp")).toBe(true);
    expect(store.getSetting("temp")).toBeUndefined();
  });

  it("deleteSetting returns false for missing key", () => {
    expect(store.deleteSetting("ghost")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pruneEvents
// ---------------------------------------------------------------------------

describe("pruneEvents", () => {
  it("deletes events older than the given threshold", () => {
    // Insert an event backdated to 2 hours ago using SQLite datetime format.
    db.prepare(
      "INSERT INTO outbox (event_type, payload, created_at) VALUES (?, ?, datetime('now', '-7200 seconds'))",
    ).run("old.event", '"old"');

    // Insert a recent event through the store (uses datetime('now')).
    store.appendEvent("new.event", "recent");

    // Prune events older than 1 hour.
    const pruned = store.pruneEvents(60 * 60 * 1000);
    expect(pruned).toBe(1);

    // Only the recent event should remain.
    const remaining = store.getEventsSince(0);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].eventType).toBe("new.event");
  });

  it("returns 0 when nothing to prune", () => {
    store.appendEvent("recent", "data");
    // Prune events older than 1 hour — the just-inserted event should survive.
    const pruned = store.pruneEvents(60 * 60 * 1000);
    expect(pruned).toBe(0);
  });
});
