import { describe, expect, it } from "vitest";
import { classifyChanges, computeConfigDiff, computeMergePatch } from "./config-diff";

describe("computeConfigDiff", () => {
  it("returns empty array for identical configs", () => {
    const config = { gateway: { port: 18789, host: "localhost" } };
    expect(computeConfigDiff(config, config)).toEqual([]);
  });

  it("detects scalar change", () => {
    const oldCfg = { gateway: { port: 18789 } };
    const newCfg = { gateway: { port: 18790 } };
    const diffs = computeConfigDiff(oldCfg, newCfg);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      path: "gateway.port",
      oldValue: 18789,
      newValue: 18790,
      type: "change",
    });
  });

  it("detects added field", () => {
    const oldCfg = { gateway: { port: 18789 } };
    const newCfg = { gateway: { port: 18789, host: "localhost" } };
    const diffs = computeConfigDiff(oldCfg, newCfg);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      path: "gateway.host",
      oldValue: undefined,
      newValue: "localhost",
      type: "add",
    });
  });

  it("detects removed field", () => {
    const oldCfg = { gateway: { port: 18789, host: "localhost" } };
    const newCfg = { gateway: { port: 18789 } };
    const diffs = computeConfigDiff(oldCfg, newCfg);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      path: "gateway.host",
      oldValue: "localhost",
      newValue: undefined,
      type: "remove",
    });
  });

  it("detects array item changes as a single entry at array path", () => {
    const oldCfg = { gateway: { allowlist: ["a", "b"] } };
    const newCfg = { gateway: { allowlist: ["a", "c"] } };
    const diffs = computeConfigDiff(oldCfg, newCfg);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe("gateway.allowlist");
    expect(diffs[0].type).toBe("change");
    expect(diffs[0].oldValue).toEqual(["a", "b"]);
    expect(diffs[0].newValue).toEqual(["a", "c"]);
  });

  it("detects top-level scalar change", () => {
    const oldCfg = { version: 1 };
    const newCfg = { version: 2 };
    const diffs = computeConfigDiff(oldCfg, newCfg);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({
      path: "version",
      oldValue: 1,
      newValue: 2,
      type: "change",
    });
  });

  it("handles multiple changes at once", () => {
    const oldCfg = { a: 1, b: 2, c: 3 };
    const newCfg = { a: 10, b: 2, d: 4 };
    const diffs = computeConfigDiff(oldCfg, newCfg);
    // a changed, c removed, d added
    expect(diffs).toHaveLength(3);
    const paths = diffs.map((d) => d.path).toSorted();
    expect(paths).toEqual(["a", "c", "d"]);
  });
});

describe("classifyChanges", () => {
  it("scalar-only changes → patch-safe", () => {
    const oldCfg = { gateway: { port: 18789 } };
    const newCfg = { gateway: { port: 18790 } };
    expect(classifyChanges(oldCfg, newCfg)).toBe("patch-safe");
  });

  it("no changes → patch-safe", () => {
    const cfg = { gateway: { port: 18789 } };
    expect(classifyChanges(cfg, cfg)).toBe("patch-safe");
  });

  it("array deletion (length change) → apply-required", () => {
    const oldCfg = { allowlist: ["a", "b", "c"] };
    const newCfg = { allowlist: ["a", "b"] };
    expect(classifyChanges(oldCfg, newCfg)).toBe("apply-required");
  });

  it("array reorder (same elements, different order) → apply-required", () => {
    const oldCfg = { allowlist: ["a", "b", "c"] };
    const newCfg = { allowlist: ["c", "b", "a"] };
    expect(classifyChanges(oldCfg, newCfg)).toBe("apply-required");
  });

  it("mixed scalar + array → apply-required", () => {
    const oldCfg = { port: 18789, allowlist: ["a"] };
    const newCfg = { port: 18790, allowlist: ["a", "b"] };
    expect(classifyChanges(oldCfg, newCfg)).toBe("apply-required");
  });

  it("nested array change → apply-required", () => {
    const oldCfg = { gateway: { routes: ["x"] } };
    const newCfg = { gateway: { routes: ["x", "y"] } };
    expect(classifyChanges(oldCfg, newCfg)).toBe("apply-required");
  });
});

describe("computeMergePatch", () => {
  it("returns empty object for no changes", () => {
    const cfg = { port: 18789, host: "localhost" };
    expect(computeMergePatch(cfg, cfg)).toEqual({});
  });

  it("includes only changed scalar paths", () => {
    const oldCfg = { port: 18789, host: "localhost" };
    const newCfg = { port: 18790, host: "localhost" };
    expect(computeMergePatch(oldCfg, newCfg)).toEqual({ port: 18790 });
  });

  it("includes added properties", () => {
    const oldCfg = { port: 18789 };
    const newCfg = { port: 18789, host: "localhost" };
    expect(computeMergePatch(oldCfg, newCfg)).toEqual({ host: "localhost" });
  });

  it("sets removed properties to null (RFC 7396 delete)", () => {
    const oldCfg = { port: 18789, host: "localhost" };
    const newCfg = { port: 18789 };
    expect(computeMergePatch(oldCfg, newCfg)).toEqual({ host: null });
  });

  it("handles nested object changes", () => {
    const oldCfg = { gateway: { port: 18789, host: "localhost" } };
    const newCfg = { gateway: { port: 18790, host: "localhost" } };
    expect(computeMergePatch(oldCfg, newCfg)).toEqual({
      gateway: { port: 18790 },
    });
  });

  it("handles array changes as atomic values", () => {
    const oldCfg = { allowlist: ["a", "b"] };
    const newCfg = { allowlist: ["a", "b", "c"] };
    expect(computeMergePatch(oldCfg, newCfg)).toEqual({
      allowlist: ["a", "b", "c"],
    });
  });

  it("handles mixed changes", () => {
    const oldCfg = { port: 18789, host: "old-host", debug: true };
    const newCfg = { port: 18790, host: "old-host" };
    // port changed, debug removed
    const patch = computeMergePatch(oldCfg, newCfg);
    expect(patch).toEqual({ port: 18790, debug: null });
  });
});
