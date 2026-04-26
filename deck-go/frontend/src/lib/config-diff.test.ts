import { describe, expect, it } from "vitest";
import { classifyChanges, computeConfigDiff, computeMergePatch } from "./config-diff";

describe("computeConfigDiff", () => {
  it("returns empty array for identical configs", () => {
    const config = { gateway: { port: 18789, host: "localhost" } };
    expect(computeConfigDiff(config, config)).toEqual([]);
  });

  it("detects scalar change", () => {
    const oldConfig = { gateway: { port: 18789 } };
    const newConfig = { gateway: { port: 18790 } };
    expect(computeConfigDiff(oldConfig, newConfig)).toEqual([
      {
        path: "gateway.port",
        oldValue: 18789,
        newValue: 18790,
        type: "change",
      },
    ]);
  });

  it("detects added and removed fields", () => {
    const oldConfig = { gateway: { port: 18789, host: "localhost" } };
    const newConfig = { gateway: { port: 18789, bind: "loopback" } };
    expect(computeConfigDiff(oldConfig, newConfig)).toEqual([
      {
        path: "gateway.host",
        oldValue: "localhost",
        newValue: undefined,
        type: "remove",
      },
      {
        path: "gateway.bind",
        oldValue: undefined,
        newValue: "loopback",
        type: "add",
      },
    ]);
  });

  it("treats array item changes as one leaf diff", () => {
    const oldConfig = { gateway: { allowlist: ["a", "b"] } };
    const newConfig = { gateway: { allowlist: ["a", "c"] } };
    expect(computeConfigDiff(oldConfig, newConfig)).toEqual([
      {
        path: "gateway.allowlist",
        oldValue: ["a", "b"],
        newValue: ["a", "c"],
        type: "change",
      },
    ]);
  });
});

describe("classifyChanges", () => {
  it("keeps scalar-only changes patch-safe", () => {
    expect(classifyChanges({ gateway: { port: 18789 } }, { gateway: { port: 18790 } })).toBe(
      "patch-safe",
    );
  });

  it("marks array mutations as apply-required", () => {
    expect(classifyChanges({ allowlist: ["a", "b"] }, { allowlist: ["b", "a"] })).toBe(
      "apply-required",
    );
  });
});

describe("computeMergePatch", () => {
  it("returns empty object for no changes", () => {
    const config = { port: 18789, host: "localhost" };
    expect(computeMergePatch(config, config)).toEqual({});
  });

  it("uses RFC 7396 null deletes and nested patches", () => {
    const oldConfig = { gateway: { port: 18789, host: "localhost" }, debug: true };
    const newConfig = { gateway: { port: 18790, host: "localhost" } };
    expect(computeMergePatch(oldConfig, newConfig)).toEqual({
      gateway: { port: 18790 },
      debug: null,
    });
  });

  it("treats arrays as atomic patch values", () => {
    expect(computeMergePatch({ allowlist: ["a"] }, { allowlist: ["a", "b"] })).toEqual({
      allowlist: ["a", "b"],
    });
  });
});
