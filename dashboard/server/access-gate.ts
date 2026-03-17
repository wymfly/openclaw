/**
 * Access Gate — cookie-free token authentication for openclaw-deck.
 *
 * Supports two header formats:
 *   1. `Authorization: Bearer <token>`
 *   2. `x-deck-token: <token>`
 *
 * Token source priority: env `DECK_ACCESS_TOKEN` > SQLite settings table.
 * When no token is configured, authentication is skipped (local dev mode).
 */
import { timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccessGateResult = { valid: boolean; error?: string };

/** Minimal DB interface — avoids importing better-sqlite3 at the type level. */
export type AccessGateDb = {
  prepare(sql: string): { get(...params: unknown[]): unknown };
};

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the configured access token.
 * Returns `null` when no token is configured (local dev mode).
 */
export function resolveToken(db?: AccessGateDb): string | null {
  const envToken = process.env.DECK_ACCESS_TOKEN;
  if (envToken) {
    return envToken;
  }

  if (!db) {
    return null;
  }
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("access_token") as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public-bind safety check
// ---------------------------------------------------------------------------

/** Returns an error string if public binding is detected without a token. */
export function checkPublicBind(bindAddress: string, token: string | null): string | null {
  if (token) {
    return null;
  }
  const loopback = ["127.0.0.1", "::1", "localhost", "0.0.0.0"];
  if (loopback.includes(bindAddress)) {
    return null;
  }
  return `Refusing to start: bind address "${bindAddress}" is not loopback and no access token is configured. Set DECK_ACCESS_TOKEN or add "access_token" to the settings table.`;
}

// ---------------------------------------------------------------------------
// Timing-safe comparison
// ---------------------------------------------------------------------------

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, "utf-8"), Buffer.from(b, "utf-8"));
}

// ---------------------------------------------------------------------------
// Header extraction
// ---------------------------------------------------------------------------

function extractToken(headers: Record<string, string | undefined>): string | null {
  const bearer = headers["authorization"];
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice(7);
  }
  return headers["x-deck-token"] ?? null;
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export function validateRequest(
  headers: Record<string, string | undefined>,
  db?: AccessGateDb,
): AccessGateResult {
  const expected = resolveToken(db);

  // No token configured → local dev mode, allow all.
  if (!expected) {
    return { valid: true };
  }

  const provided = extractToken(headers);
  if (!provided) {
    return { valid: false, error: "Missing authentication token." };
  }
  if (!safeEqual(provided, expected)) {
    return { valid: false, error: "Invalid authentication token." };
  }

  return { valid: true };
}
