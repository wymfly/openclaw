import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateRequest,
  resolveToken,
  checkPublicBind,
} from "../access-gate.js";

// Mock the deck-settings module
vi.mock("../deck-settings.js", () => {
  let settings: Record<string, string> = {};
  return {
    getSetting: (key: string) => settings[key],
    setSetting: (key: string, value: string) => { settings[key] = value; },
    getDeckSettings: () => ({
      get: () => settings,
      set: (v: Record<string, string>) => { settings = v; },
    }),
    __setMockSettings: (s: Record<string, string>) => { settings = s; },
  };
});

// Helper to set mock settings
async function setMockSettings(s: Record<string, string>) {
  const mod = await import("../deck-settings.js") as unknown as { __setMockSettings: (s: Record<string, string>) => void };
  mod.__setMockSettings(s);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = "deck-test-token-abc123";

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

  it("prefers env var over settings store", async () => {
    process.env.DECK_ACCESS_TOKEN = "env-token";
    await setMockSettings({ access_token: "store-token" });
    expect(resolveToken()).toBe("env-token");
  });

  it("falls back to settings store when env is unset", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    await setMockSettings({ access_token: "store-token" });
    expect(resolveToken()).toBe("store-token");
  });

  it("returns null when neither env nor store has a token", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    await setMockSettings({});
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
  });

  it("rejects 0.0.0.0 without token (not loopback)", () => {
    const result = checkPublicBind("0.0.0.0", null);
    expect(result).toContain("Refusing to start");
  });

  it("allows 0.0.0.0 with token", () => {
    expect(checkPublicBind("0.0.0.0", SECRET)).toBeNull();
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

  it("allows request when no token is configured (local dev mode)", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    await setMockSettings({});
    const result = validateRequest({});
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

  it("uses settings store token when env is unset", async () => {
    delete process.env.DECK_ACCESS_TOKEN;
    await setMockSettings({ access_token: "store-secret" });
    const result = validateRequest({ "x-deck-token": "store-secret" });
    expect(result).toEqual({ valid: true });
  });
});
