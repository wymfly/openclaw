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
// chat session projections
// ---------------------------------------------------------------------------

describe("chat session projections", () => {
  it("stores and loads a session-scoped projection payload", () => {
    store.setChatSessionProjection("agent:main:main", {
      a2uiState: {
        visible: true,
        url: "/api/canvas/index.html",
        surfaces: ["main"],
        eventLog: [
          {
            timestamp: 1,
            direction: "inbound",
            action: "surfaceUpdate",
            summary: "Surface main updated",
            raw: { surfaceId: "main" },
          },
        ],
      },
    });

    expect(store.getChatSessionProjection("agent:main:main")).toEqual({
      a2uiState: {
        visible: true,
        url: "/api/canvas/index.html",
        surfaces: ["main"],
        eventLog: [
          {
            timestamp: 1,
            direction: "inbound",
            action: "surfaceUpdate",
            summary: "Surface main updated",
            raw: { surfaceId: "main" },
          },
        ],
      },
    });
  });

  it("returns null when a chat projection is missing", () => {
    expect(store.getChatSessionProjection("missing-session")).toBeNull();
  });

  it("clears only the targeted session projection", () => {
    store.setChatSessionProjection("session-a", {
      a2uiState: { visible: true, surfaces: ["a"] },
    });
    store.setChatSessionProjection("session-b", {
      a2uiState: { visible: false, surfaces: ["b"] },
    });

    expect(store.clearChatSessionProjection("session-a")).toBe(true);
    expect(store.getChatSessionProjection("session-a")).toBeNull();
    expect(store.getChatSessionProjection("session-b")).toEqual({
      a2uiState: { visible: false, surfaces: ["b"] },
    });
  });
});

// ---------------------------------------------------------------------------
// generic projection API
// ---------------------------------------------------------------------------

describe("generic projection API", () => {
  it("returns null for non-existent projection", () => {
    expect(store.getProjection<{ x: number }>("myDomain", "missing")).toBeNull();
  });

  it("writes and reads a projection by domain and key", () => {
    store.setProjection("approval", "session-1", { id: "apr-1", toolName: "command" });
    expect(store.getProjection<{ id: string }>("approval", "session-1")).toEqual({
      id: "apr-1",
      toolName: "command",
    });
  });

  it("overwrites an existing projection", () => {
    store.setProjection("approval", "session-1", { v: 1 });
    store.setProjection("approval", "session-1", { v: 2 });
    expect(store.getProjection<{ v: number }>("approval", "session-1")).toEqual({ v: 2 });
  });

  it("clears a projection and returns true", () => {
    store.setProjection("approval", "session-1", { id: "apr-1" });
    expect(store.clearProjection("approval", "session-1")).toBe(true);
    expect(store.getProjection("approval", "session-1")).toBeNull();
  });

  it("returns false when clearing a non-existent projection", () => {
    expect(store.clearProjection("approval", "ghost")).toBe(false);
  });

  it("isolates projections across domains with the same key", () => {
    store.setProjection("chat", "session-1", { chat: true });
    store.setProjection("approval", "session-1", { approval: true });

    expect(store.getProjection<{ chat: boolean }>("chat", "session-1")).toEqual({ chat: true });
    expect(store.getProjection<{ approval: boolean }>("approval", "session-1")).toEqual({
      approval: true,
    });
  });

  it("chat domain uses legacy key prefix for backward compatibility", () => {
    store.setProjection("chat", "session-bc", { a2uiState: { visible: true } });
    const raw = store.getSetting("chat_projection:session-bc");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ a2uiState: { visible: true } });
  });

  it("non-chat domains use projection: prefix", () => {
    store.setProjection("approval", "session-ap", { id: "apr-x" });
    const raw = store.getSetting("projection:approval:session-ap");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ id: "apr-x" });
  });

  it("reads legacy chat data written by old chat-specific API", () => {
    store.setChatSessionProjection("session-legacy", { a2uiState: { url: "/test" } });
    expect(store.getProjection("chat", "session-legacy")).toEqual({ a2uiState: { url: "/test" } });
  });

  it("handles empty key gracefully", () => {
    store.setProjection("chat", "", { x: 1 });
    expect(store.getProjection("chat", "")).toBeNull();
  });

  it("handles whitespace-only key gracefully", () => {
    store.setProjection("chat", "  ", { x: 1 });
    expect(store.getProjection("chat", "  ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// approval migration from legacy chat blob
// ---------------------------------------------------------------------------

describe("approval migration from legacy chat blob", () => {
  it("migrates activeApproval from chat blob to approval domain on first read", () => {
    store.setChatSessionProjection("session-migrate", {
      a2uiState: { visible: true },
      activeApproval: {
        id: "apr-legacy",
        toolName: "command",
        command: "rm -rf /",
        description: "/tmp",
      },
    });

    const approval = store.getApprovalProjectionWithMigration("session-migrate");
    expect(approval).toEqual({
      id: "apr-legacy",
      toolName: "command",
      command: "rm -rf /",
      description: "/tmp",
    });

    const chatBlob = store.getChatSessionProjection("session-migrate");
    expect(chatBlob).toEqual({ a2uiState: { visible: true } });
    expect(chatBlob?.activeApproval).toBeUndefined();

    expect(store.getProjection("approval", "session-migrate")).toEqual({
      id: "apr-legacy",
      toolName: "command",
      command: "rm -rf /",
      description: "/tmp",
    });
  });

  it("returns null when neither approval domain nor chat blob has approval", () => {
    store.setChatSessionProjection("session-no-approval", {
      a2uiState: { visible: false },
    });

    expect(store.getApprovalProjectionWithMigration("session-no-approval")).toBeNull();
  });

  it("reads from approval domain without migration when already populated", () => {
    store.setProjection("approval", "session-pre", { id: "apr-new", toolName: "command" });
    store.setChatSessionProjection("session-pre", {
      activeApproval: { id: "apr-stale", toolName: "command" },
    });

    expect(store.getApprovalProjectionWithMigration("session-pre")).toEqual({
      id: "apr-new",
      toolName: "command",
    });
    expect(store.getChatSessionProjection("session-pre")?.activeApproval?.id).toBe("apr-stale");
  });

  it("preserves a2uiState in chat blob during migration", () => {
    const a2ui = { visible: true, url: "/canvas", surfaces: ["main"] };
    store.setChatSessionProjection("session-a2ui", {
      a2uiState: a2ui,
      activeApproval: { id: "apr-a2ui", toolName: "command" },
    });

    store.getApprovalProjectionWithMigration("session-a2ui");

    const chatBlob = store.getChatSessionProjection("session-a2ui");
    expect(chatBlob?.a2uiState).toEqual(a2ui);
    expect(chatBlob?.activeApproval).toBeUndefined();
  });

  it("clears chat blob entirely if only activeApproval was present", () => {
    store.setChatSessionProjection("session-only-approval", {
      activeApproval: { id: "apr-only", toolName: "command" },
    });

    store.getApprovalProjectionWithMigration("session-only-approval");

    expect(store.getChatSessionProjection("session-only-approval")).toBeNull();
  });

  it("returns null for empty/whitespace session key", () => {
    expect(store.getApprovalProjectionWithMigration("")).toBeNull();
    expect(store.getApprovalProjectionWithMigration("  ")).toBeNull();
  });

  it("does not overwrite a concurrent approval domain write during migration (3.3)", () => {
    store.setChatSessionProjection("session-race", {
      a2uiState: { visible: true },
      activeApproval: { id: "apr-stale", toolName: "command" },
    });

    store.setProjection("approval", "session-race", {
      id: "apr-fresh",
      toolName: "command",
      command: "new-cmd",
    });

    const result = store.getApprovalProjectionWithMigration("session-race");
    expect(result).toEqual({
      id: "apr-fresh",
      toolName: "command",
      command: "new-cmd",
    });

    expect(store.getChatSessionProjection("session-race")?.activeApproval?.id).toBe("apr-stale");
  });

  it("preserves concurrent a2uiState update during migration (3.3)", () => {
    store.setChatSessionProjection("session-a2ui-race", {
      a2uiState: { visible: false },
      activeApproval: { id: "apr-a2ui-race", toolName: "command" },
    });

    store.setChatSessionProjection("session-a2ui-race", {
      a2uiState: { visible: true, url: "/updated" },
      activeApproval: { id: "apr-a2ui-race", toolName: "command" },
    });

    store.getApprovalProjectionWithMigration("session-a2ui-race");

    const chatBlob = store.getChatSessionProjection("session-a2ui-race");
    expect(chatBlob?.a2uiState).toEqual({ visible: true, url: "/updated" });
    expect(chatBlob?.activeApproval).toBeUndefined();
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
