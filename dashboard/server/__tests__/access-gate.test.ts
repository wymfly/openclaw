import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validateRequest,
  resolveToken,
  checkPublicBind,
  type AccessGateDb,
} from "../access-gate.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = "deck-test-token-abc123";

function makeMockDb(token?: string): AccessGateDb {
  return {
    prepare(_sql: string) {
      return {
        get(..._params: unknown[]) {
          if (token) {
            return { value: token };
          }
          return undefined;
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

describe("resolveToken", () => {
  const originalEnv = process.env.DECK_ACCESS_TOKEN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DECK_ACCESS_TOKEN;
    } else {
      process.env.DECK_ACCESS_TOKEN = originalEnv;
    }
  });

  it("prefers env var over db", () => {
    process.env.DECK_ACCESS_TOKEN = "env-token";
    const db = makeMockDb("db-token");
    expect(resolveToken(db)).toBe("env-token");
  });

  it("falls back to db when env is unset", () => {
    delete process.env.DECK_ACCESS_TOKEN;
    const db = makeMockDb("db-token");
    expect(resolveToken(db)).toBe("db-token");
  });

  it("returns null when neither env nor db has a token", () => {
    delete process.env.DECK_ACCESS_TOKEN;
    expect(resolveToken(makeMockDb())).toBeNull();
  });

  it("returns null when no db is provided and env is unset", () => {
    delete process.env.DECK_ACCESS_TOKEN;
    expect(resolveToken()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Public bind safety
// ---------------------------------------------------------------------------

describe("checkPublicBind", () => {
  it("allows loopback addresses without token", () => {
    expect(checkPublicBind("127.0.0.1", null)).toBeNull();
    expect(checkPublicBind("::1", null)).toBeNull();
    expect(checkPublicBind("localhost", null)).toBeNull();
    expect(checkPublicBind("0.0.0.0", null)).toBeNull();
  });

  it("rejects public address without token", () => {
    const result = checkPublicBind("192.168.1.100", null);
    expect(result).toContain("Refusing to start");
  });

  it("allows public address with token", () => {
    expect(checkPublicBind("192.168.1.100", SECRET)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateRequest
// ---------------------------------------------------------------------------

describe("validateRequest", () => {
  const originalEnv = process.env.DECK_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.DECK_ACCESS_TOKEN = SECRET;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DECK_ACCESS_TOKEN;
    } else {
      process.env.DECK_ACCESS_TOKEN = originalEnv;
    }
  });

  it("accepts valid Bearer token", () => {
    const result = validateRequest({ authorization: `Bearer ${SECRET}` });
    expect(result).toEqual({ valid: true });
  });

  it("accepts valid x-deck-token header", () => {
    const result = validateRequest({ "x-deck-token": SECRET });
    expect(result).toEqual({ valid: true });
  });

  it("rejects invalid token", () => {
    const result = validateRequest({ authorization: "Bearer wrong-token" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid");
  });

  it("rejects missing token when auth is configured", () => {
    const result = validateRequest({});
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Missing");
  });

  it("allows request when no token is configured (local dev mode)", () => {
    delete process.env.DECK_ACCESS_TOKEN;
    const result = validateRequest({}, makeMockDb());
    expect(result).toEqual({ valid: true });
  });

  it("prefers Authorization header over x-deck-token", () => {
    const result = validateRequest({
      authorization: `Bearer ${SECRET}`,
      "x-deck-token": "wrong-token",
    });
    expect(result).toEqual({ valid: true });
  });

  it("rejects token with different length (timing-safe)", () => {
    const result = validateRequest({ authorization: "Bearer short" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid");
  });

  it("uses db token when env is unset", () => {
    delete process.env.DECK_ACCESS_TOKEN;
    const db = makeMockDb("db-secret");
    const result = validateRequest({ "x-deck-token": "db-secret" }, db);
    expect(result).toEqual({ valid: true });
  });
});
