/**
 * Projection Store — thin persistence layer on top of SQLite for openclaw-deck.
 * Simplified from openclaw-studio: outbox + settings tables only.
 */
import type BetterSqlite3 from "better-sqlite3";
import { getDb } from "./db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Database = BetterSqlite3.Database;
type Statement<B extends unknown[], R> = BetterSqlite3.Statement<B, R>;

export type OutboxRow = {
  id: number;
  event_type: string;
  payload: string;
  created_at: string;
};

export type SettingRow = {
  key: string;
  value: string;
  updated_at: string;
};

export type OutboxEntry = {
  id: number;
  eventType: string;
  payload: unknown;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toOutboxEntry = (row: OutboxRow): OutboxEntry => ({
  id: row.id,
  eventType: row.event_type,
  payload: JSON.parse(row.payload) as unknown,
  createdAt: row.created_at,
});

// ---------------------------------------------------------------------------
// ProjectionStore
// ---------------------------------------------------------------------------

export class ProjectionStore {
  private readonly db: Database;

  // Prepared statements (lazy — created on first use).
  private _insertOutbox: Statement<[string, string], unknown> | null = null;
  private _selectAfter: Statement<[number, number], OutboxRow> | null = null;
  private _selectHead: Statement<[], { head: number }> | null = null;
  private _getSetting: Statement<[string], SettingRow | undefined> | null = null;
  private _upsertSetting: Statement<[string, string], unknown> | null = null;
  private _deleteSetting: Statement<[string], unknown> | null = null;
  private _pruneOutbox: Statement<[number], unknown> | null = null;

  constructor(db?: Database) {
    this.db = db ?? getDb();
  }

  // -- Lazy statement getters ------------------------------------------------

  private get insertOutboxStmt() {
    return (this._insertOutbox ??= this.db.prepare(
      "INSERT INTO outbox (event_type, payload, created_at) VALUES (?, ?, datetime('now'))",
    ));
  }

  private get selectAfterStmt() {
    return (this._selectAfter ??= this.db.prepare(
      "SELECT id, event_type, payload, created_at FROM outbox WHERE id > ? ORDER BY id ASC LIMIT ?",
    ));
  }

  private get selectHeadStmt() {
    return (this._selectHead ??= this.db.prepare(
      "SELECT COALESCE(MAX(id), 0) AS head FROM outbox",
    ));
  }

  private get getSettingStmt() {
    return (this._getSetting ??= this.db.prepare(
      "SELECT key, value, updated_at FROM settings WHERE key = ?",
    ));
  }

  private get upsertSettingStmt() {
    return (this._upsertSetting ??= this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `));
  }

  private get deleteSettingStmt() {
    return (this._deleteSetting ??= this.db.prepare("DELETE FROM settings WHERE key = ?"));
  }

  private get pruneOutboxStmt() {
    // Use SQLite's own datetime arithmetic so format matches `datetime('now')`.
    return (this._pruneOutbox ??= this.db.prepare(
      "DELETE FROM outbox WHERE created_at < datetime('now', ? || ' seconds')",
    ));
  }

  // -- Outbox API ------------------------------------------------------------

  /** Append a domain event to the outbox. Returns the new row ID. */
  appendEvent(type: string, payload: unknown): number {
    const json = JSON.stringify(payload);
    const info = this.insertOutboxStmt.run(type, json);
    return Number(info.lastInsertRowid);
  }

  /**
   * Read outbox events with `id > lastId`, ordered ascending.
   * Default limit is 500.
   */
  getEventsSince(lastId: number, limit = 500): OutboxEntry[] {
    const safeLastId = Number.isFinite(lastId) && lastId >= 0 ? lastId : 0;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 500;
    return this.selectAfterStmt.all(safeLastId, safeLimit).map(toOutboxEntry);
  }

  /** Return the highest outbox ID (0 if empty). */
  outboxHead(): number {
    const row = this.selectHeadStmt.get() as { head: number } | undefined;
    return row?.head ?? 0;
  }

  // -- Settings API ----------------------------------------------------------

  /** Get a setting value by key. Returns `undefined` if not found. */
  getSetting(key: string): string | undefined {
    const row = this.getSettingStmt.get(key);
    return row?.value;
  }

  /** Upsert a setting (insert or update). */
  setSetting(key: string, value: string): void {
    this.upsertSettingStmt.run(key, value);
  }

  /** Delete a setting by key. Returns true if a row was removed. */
  deleteSetting(key: string): boolean {
    const info = this.deleteSettingStmt.run(key);
    return (info.changes ?? 0) > 0;
  }

  // -- Maintenance -----------------------------------------------------------

  /**
   * Delete outbox events older than `olderThanMs` milliseconds.
   * Returns the number of deleted rows.
   */
  pruneEvents(olderThanMs: number): number {
    // Convert ms to negative seconds offset for SQLite's datetime modifier.
    const offsetSeconds = -Math.floor(olderThanMs / 1000);
    const info = this.pruneOutboxStmt.run(offsetSeconds);
    return info.changes ?? 0;
  }

  /** Close the underlying database (for tests / graceful shutdown). */
  close(): void {
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor (mirrors getDb pattern)
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__openclawDeckProjectionStore__";

export function getProjectionStore(): ProjectionStore {
  const g = globalThis as unknown as Record<string, ProjectionStore | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new ProjectionStore();
  }
  return g[GLOBAL_KEY];
}
