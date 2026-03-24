import { describe, expect, it } from "vitest";
import { computeBindingId, normalizeBindingMatchForHash, validateBaseHash } from "./utils.js";

describe("normalizeBindingMatchForHash", () => {
  it("sorts keys alphabetically", () => {
    const result = normalizeBindingMatchForHash({ z: "val", a: "val" });
    expect(Object.keys(result)).toEqual(["a", "z"]);
  });

  it("lowercases and trims string values", () => {
    const result = normalizeBindingMatchForHash({ channel: "  Discord  " });
    expect(result.channel).toBe("discord");
  });

  it("strips null and undefined values", () => {
    const result = normalizeBindingMatchForHash({ a: "keep", b: null, c: undefined });
    expect(result).toEqual({ a: "keep" });
  });

  it("recursively normalizes nested objects", () => {
    const result = normalizeBindingMatchForHash({
      peer: { kind: "Channel", id: "Dev" },
    });
    expect(result.peer).toEqual({ id: "dev", kind: "channel" });
  });

  it("sorts and lowercases array string values", () => {
    const result = normalizeBindingMatchForHash({ roles: ["Admin", "Mod"] });
    expect(result.roles).toEqual(["admin", "mod"]);
  });
});

describe("computeBindingId", () => {
  it("produces deterministic ID for same match", () => {
    const match = { channel: "discord", peer: { kind: "channel", id: "dev" } };
    expect(computeBindingId(match)).toBe(computeBindingId(match));
    expect(computeBindingId(match)).toHaveLength(12);
  });

  it("produces same ID regardless of key order", () => {
    const a = { channel: "discord", accountId: "srv" };
    const b = { accountId: "srv", channel: "discord" };
    expect(computeBindingId(a)).toBe(computeBindingId(b));
  });

  it("normalizes case", () => {
    const a = { channel: "Discord" };
    const b = { channel: "discord" };
    expect(computeBindingId(a)).toBe(computeBindingId(b));
  });

  it("produces different IDs for different matches", () => {
    const a = { channel: "discord" };
    const b = { channel: "telegram" };
    expect(computeBindingId(a)).not.toBe(computeBindingId(b));
  });

  it("returns hex string of length 12", () => {
    const id = computeBindingId({ channel: "test" });
    expect(id).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("validateBaseHash", () => {
  it("returns null on match", () => {
    expect(validateBaseHash("abc", "abc")).toBeNull();
  });

  it("returns error on mismatch", () => {
    const err = validateBaseHash("old", "new");
    expect(err?.code).toBe("INVALID_REQUEST");
    expect(err?.message).toContain("baseHash");
  });

  it("returns INVALID_REQUEST when undefined", () => {
    const err = validateBaseHash(undefined, "abc");
    expect(err?.code).toBe("INVALID_REQUEST");
  });

  it("returns INVALID_REQUEST when empty string", () => {
    const err = validateBaseHash("", "abc");
    expect(err?.code).toBe("INVALID_REQUEST");
  });
});
