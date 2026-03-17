/**
 * SQLite database layer for openclaw-deck.
 *
 * Opens a WAL-mode better-sqlite3 database and auto-runs numbered SQL
 * migrations from `dashboard/migrations/`. Uses a globalThis singleton
 * so the connection survives Next.js HMR reloads.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BetterSqlite3Factory = typeof BetterSqlite3;
type BetterSqlite3Database = BetterSqlite3.Database;

export type { BetterSqlite3Database as Database };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__openclawDeckDb__";
const DEFAULT_DB_DIR = ".openclaw/openclaw-deck";
const DEFAULT_DB_FILE = "deck.db";
const MIGRATION_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../migrations",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
const loadBetterSqlite3 = (): BetterSqlite3Factory =>
  require("better-sqlite3") as BetterSqlite3Factory;

/** Resolve default DB path: `~/.openclaw/openclaw-deck/deck.db` */
const resolveDefaultDbPath = (): string => {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return path.join(home, DEFAULT_DB_DIR, DEFAULT_DB_FILE);
};

/**
 * Parse migration filenames like `001_init.sql` and return the version number.
 * Returns null for non-matching filenames.
 */
const parseMigrationVersion = (filename: string): number | null => {
  const match = filename.match(/^(\d+)[_-].+\.sql$/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
};

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

function runMigrations(db: BetterSqlite3Database): void {
  if (!fs.existsSync(MIGRATION_DIR)) {
    return;
  }

  const files = fs
    .readdirSync(MIGRATION_DIR)
    .filter((f) => parseMigrationVersion(f) !== null)
    .toSorted();

  if (files.length === 0) {
    return;
  }

  // Ensure schema_version table exists (bootstrap — first migration creates it too,
  // but we need to query it before running any migration).
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    (
      db.prepare("SELECT version FROM schema_version").all() as Array<{
        version: number;
      }>
    ).map((r) => r.version),
  );

  const applyMigration = db.transaction((version: number, sql: string): void => {
    db.exec(sql);
    db.prepare("INSERT OR IGNORE INTO schema_version (version) VALUES (?)").run(version);
  });

  for (const file of files) {
    const version = parseMigrationVersion(file)!;
    if (applied.has(version)) {
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATION_DIR, file), "utf-8");
    applyMigration(version, sql);
  }
}

// ---------------------------------------------------------------------------
// openDb — create / open a database and run migrations
// ---------------------------------------------------------------------------

export function openDb(dbPath?: string): BetterSqlite3Database {
  const resolvedPath = dbPath ?? process.env.DECK_DB_PATH ?? resolveDefaultDbPath();

  // Ensure parent directory exists (skip for in-memory DBs).
  if (resolvedPath !== ":memory:") {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const BetterSqlite3Ctor = loadBetterSqlite3();
  const db = new BetterSqlite3Ctor(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);
  return db;
}

// ---------------------------------------------------------------------------
// getDb — globalThis singleton (HMR-safe)
// ---------------------------------------------------------------------------

export function getDb(): BetterSqlite3Database {
  const g = globalThis as unknown as Record<string, BetterSqlite3Database | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = openDb();
  }
  return g[GLOBAL_KEY];
}
