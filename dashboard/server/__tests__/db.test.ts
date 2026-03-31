import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import type { Database } from "../db.js";
import { openDb, preloadSqlJs } from "../db.js";

beforeAll(async () => {
  await preloadSqlJs();
});

// ---------------------------------------------------------------------------
// Helpers — use temp files so we never touch ~/.openclaw
// ---------------------------------------------------------------------------

let dbs: Database[] = [];

function createTempDb(): Database {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-db-test-"));
  const dbPath = path.join(dir, "test.db");
  const db = openDb(dbPath);
  dbs.push(db);
  return db;
}

function createMemoryDb(): Database {
  const db = openDb(":memory:");
  dbs.push(db);
  return db;
}

afterEach(() => {
  for (const db of dbs) {
    try {
      db.close();
    } catch {
      // already closed
    }
  }
  dbs = [];
});

// ---------------------------------------------------------------------------
// Migration execution
// ---------------------------------------------------------------------------

describe("migrations", () => {
  it("auto-runs 001_init migration on fresh database", () => {
    const db = createMemoryDb();

    // schema_version should exist and contain version 1
    const versions = db
      .prepare("SELECT version FROM schema_version ORDER BY version")
      .all() as Array<{ version: number }>;

    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].version).toBe(1);
  });

  it("creates outbox table with expected columns", () => {
    const db = createMemoryDb();
    const cols = db.prepare("PRAGMA table_info(outbox)").all() as Array<{
      name: string;
    }>;
    const names = cols.map((c) => c.name);

    expect(names).toContain("id");
    expect(names).toContain("event_type");
    expect(names).toContain("payload");
    expect(names).toContain("created_at");
  });

  it("creates settings table with expected columns", () => {
    const db = createMemoryDb();
    const cols = db.prepare("PRAGMA table_info(settings)").all() as Array<{
      name: string;
    }>;
    const names = cols.map((c) => c.name);

    expect(names).toContain("key");
    expect(names).toContain("value");
    expect(names).toContain("updated_at");
  });
});

// ---------------------------------------------------------------------------
// schema_version tracking
// ---------------------------------------------------------------------------

describe("schema_version tracking", () => {
  it("records applied_at timestamp for each migration", () => {
    const db = createMemoryDb();
    const rows = db.prepare("SELECT version, applied_at FROM schema_version").all() as Array<{
      version: number;
      applied_at: string;
    }>;

    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row.applied_at).toBeTruthy();
    }
  });

  it("does not re-run already applied migrations", () => {
    // Open, close, re-open the same file — version count stays the same.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-db-rerun-"));
    const dbPath = path.join(dir, "test.db");

    const db1 = openDb(dbPath);
    const count1 = (
      db1.prepare("SELECT COUNT(*) AS cnt FROM schema_version").get() as {
        cnt: number;
      }
    ).cnt;
    db1.close();

    const db2 = openDb(dbPath);
    dbs.push(db2);
    const count2 = (
      db2.prepare("SELECT COUNT(*) AS cnt FROM schema_version").get() as {
        cnt: number;
      }
    ).cnt;

    expect(count2).toBe(count1);
  });
});

// ---------------------------------------------------------------------------
// WAL mode
// ---------------------------------------------------------------------------

describe("journal mode", () => {
  it("reports journal mode via pragma (sql.js uses memory mode)", () => {
    const db = createTempDb();
    const mode = db.pragma("journal_mode", { simple: true }) as string;
    // sql.js WASM does not support WAL — returns "memory" instead
    expect(mode).toBe("memory");
  });
});
