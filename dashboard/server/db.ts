/**
 * SQLite database layer for openclaw-deck.
 *
 * Uses sql.js (WASM-based SQLite) for zero native addon dependency.
 * Opens an in-memory database loaded from a file, auto-runs numbered SQL
 * migrations from `dashboard/migrations/`. Uses a globalThis singleton
 * so the connection survives Next.js HMR reloads.
 *
 * Exposes a better-sqlite3-compatible API surface so consumers don't need changes.
 */
import fs from "node:fs";
import path from "node:path";
import type { Database as SqlJsDatabase, SqlJsStatic, SqlValue } from "sql.js";

// ---------------------------------------------------------------------------
// Module-level WASM engine cache
// ---------------------------------------------------------------------------

let _engine: SqlJsStatic | null = null;

/**
 * Preload sql.js WASM engine. Must be called once at startup (via instrumentation.ts)
 * before any database operations. Subsequent calls are no-ops.
 */
export async function preloadSqlJs(): Promise<void> {
	if (!_engine) {
		const initSqlJs = (await import("sql.js")).default;
		_engine = await initSqlJs();
	}
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunResult {
	changes: number;
	lastInsertRowid: number | bigint;
}

// ---------------------------------------------------------------------------
// StatementAdapter — wraps sql.js calls to match better-sqlite3 Statement API
// ---------------------------------------------------------------------------

class StatementAdapter {
	constructor(
		private db: SqlJsDatabase,
		private sql: string,
		private saveFn: () => void,
	) {}

	run(...params: unknown[]): RunResult {
		this.db.run(this.sql, params as any[]);
		const changes = this.db.getRowsModified();
		const result = this.db.exec("SELECT last_insert_rowid() AS v");
		const lastInsertRowid = result.length > 0 ? (result[0].values[0][0] as number) : 0;
		this.saveFn();
		return { changes, lastInsertRowid };
	}

	get(...params: unknown[]): Record<string, unknown> | undefined {
		const results = this.db.exec(this.sql, params as any[]);
		if (!results.length || !results[0].values.length) return undefined;
		const { columns, values } = results[0];
		const row: Record<string, unknown> = {};
		for (let i = 0; i < columns.length; i++) {
			row[columns[i]] = values[0][i];
		}
		return row;
	}

	all(...params: unknown[]): Array<Record<string, unknown>> {
		const results = this.db.exec(this.sql, params as any[]);
		if (!results.length) return [];
		const { columns, values } = results[0];
		return values.map((row: SqlValue[]) => {
			const obj: Record<string, unknown> = {};
			for (let i = 0; i < columns.length; i++) {
				obj[columns[i]] = row[i];
			}
			return obj;
		});
	}
}

// ---------------------------------------------------------------------------
// DatabaseAdapter — wraps sql.js Database to match better-sqlite3 Database API
// ---------------------------------------------------------------------------

class DatabaseAdapter {
	private _inTransaction = false;

	constructor(
		private db: SqlJsDatabase,
		private dbPath: string,
	) {}

	prepare(sql: string): StatementAdapter {
		return new StatementAdapter(this.db, sql, () => this.maybeSave());
	}

	exec(sql: string): void {
		this.db.run(sql);
		this.maybeSave();
	}

	pragma(str: string, opts?: { simple?: boolean }): unknown {
		// WAL mode not supported by WASM — silently skip
		if (str.toLowerCase().includes("journal_mode")) {
			if (opts?.simple) return "memory";
			return undefined;
		}
		const result = this.db.exec(`PRAGMA ${str}`);
		if (opts?.simple && result.length > 0 && result[0].values.length > 0) {
			return result[0].values[0][0];
		}
		return undefined;
	}

	transaction<T extends (...args: any[]) => any>(fn: T): T {
		const wrapped = ((...args: any[]) => {
			this._inTransaction = true;
			try {
				this.db.run("BEGIN");
				const result = fn(...args);
				this.db.run("COMMIT");
				this.save(); // Single save after commit — not per-statement
				return result;
			} catch (e) {
				try {
					this.db.run("ROLLBACK");
				} catch {
					// ROLLBACK may fail if BEGIN itself failed
				}
				throw e;
			} finally {
				this._inTransaction = false;
			}
		}) as unknown as T;
		return wrapped;
	}

	close(): void {
		this.save();
		this.db.close();
	}

	/** Save only if not inside a transaction (deferred to commit) */
	private maybeSave(): void {
		if (!this._inTransaction) this.save();
	}

	/** Atomic persist: write to tmp then rename */
	private save(): void {
		if (this.dbPath === ":memory:") return;
		const data = this.db.export();
		const tmp = this.dbPath + ".tmp";
		fs.writeFileSync(tmp, Buffer.from(data));
		fs.renameSync(tmp, this.dbPath);
	}
}

export type Database = DatabaseAdapter;

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

/** Resolve default DB path: `~/.openclaw/openclaw-deck/deck.db` */
const resolveDefaultDbPath = (): string => {
	const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
	return path.join(home, DEFAULT_DB_DIR, DEFAULT_DB_FILE);
};

const parseMigrationVersion = (filename: string): number | null => {
	const match = filename.match(/^(\d+)[_-].+\.sql$/);
	if (!match) return null;
	return Number(match[1]);
};

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

function runMigrations(db: DatabaseAdapter): void {
	if (!fs.existsSync(MIGRATION_DIR)) return;

	const files = fs
		.readdirSync(MIGRATION_DIR)
		.filter((f) => parseMigrationVersion(f) !== null)
		.toSorted();

	if (files.length === 0) return;

	db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

	const applied = new Set(
		(db.prepare("SELECT version FROM schema_version").all() as Array<{ version: number }>).map(
			(r) => r.version,
		),
	);

	const applyMigration = db.transaction((version: number, sql: string): void => {
		db.exec(sql);
		db.prepare("INSERT OR IGNORE INTO schema_version (version) VALUES (?)").run(version);
	});

	for (const file of files) {
		const version = parseMigrationVersion(file)!;
		if (applied.has(version)) continue;
		const sql = fs.readFileSync(path.join(MIGRATION_DIR, file), "utf-8");
		applyMigration(version, sql);
	}
}

// ---------------------------------------------------------------------------
// openDb — create / open a database and run migrations
// ---------------------------------------------------------------------------

export function openDb(dbPath?: string): DatabaseAdapter {
	if (!_engine) {
		throw new Error("sql.js not preloaded — call preloadSqlJs() before opening database");
	}

	const resolvedPath = dbPath ?? process.env.DECK_DB_PATH ?? resolveDefaultDbPath();

	// Ensure parent directory exists (skip for in-memory DBs).
	if (resolvedPath !== ":memory:") {
		const dir = path.dirname(resolvedPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}

	// Load existing database file if present
	let buffer: Uint8Array | undefined;
	if (resolvedPath !== ":memory:" && fs.existsSync(resolvedPath)) {
		buffer = new Uint8Array(fs.readFileSync(resolvedPath));
	}

	const sqlDb = new _engine.Database(buffer);
	const db = new DatabaseAdapter(sqlDb, resolvedPath);

	// WAL not supported by WASM; journal_mode pragma is silently skipped
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");

	runMigrations(db);
	return db;
}

// ---------------------------------------------------------------------------
// getDb — globalThis singleton (HMR-safe)
// ---------------------------------------------------------------------------

export function getDb(): DatabaseAdapter {
	const g = globalThis as unknown as Record<string, DatabaseAdapter | undefined>;
	if (!g[GLOBAL_KEY]) {
		g[GLOBAL_KEY] = openDb();
	}
	return g[GLOBAL_KEY];
}
