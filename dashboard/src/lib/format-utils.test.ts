import { describe, it, expect } from "vitest";
import { formatTokenCount, formatDuration, formatParamSummary } from "./format-utils.js";

describe("formatTokenCount", () => {
  it("returns exact number for counts below 1000", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(1)).toBe("1");
    expect(formatTokenCount(42)).toBe("42");
    expect(formatTokenCount(999)).toBe("999");
  });

  it("returns abbreviated format for counts >= 1000", () => {
    expect(formatTokenCount(1000)).toBe("1.0k");
    expect(formatTokenCount(1500)).toBe("1.5k");
    expect(formatTokenCount(2345)).toBe("2.3k");
    expect(formatTokenCount(10000)).toBe("10.0k");
    expect(formatTokenCount(99999)).toBe("100.0k");
    expect(formatTokenCount(1234567)).toBe("1234.6k");
  });

  it("returns dash for undefined", () => {
    expect(formatTokenCount(undefined)).toBe("\u2014");
  });
});

describe("formatDuration", () => {
  it("formats sub-minute durations as seconds", () => {
    expect(formatDuration(0)).toBe("0.0s");
    expect(formatDuration(500)).toBe("0.5s");
    expect(formatDuration(1234)).toBe("1.2s");
    expect(formatDuration(59999)).toBe("60.0s");
  });

  it("formats durations >= 60s with minutes and seconds", () => {
    expect(formatDuration(60000)).toBe("1m 0s");
    expect(formatDuration(61000)).toBe("1m 1s");
    expect(formatDuration(90000)).toBe("1m 30s");
    expect(formatDuration(125000)).toBe("2m 5s");
  });

  it("returns dash for undefined", () => {
    expect(formatDuration(undefined)).toBe("\u2014");
  });
});

describe("formatParamSummary", () => {
  it("returns empty string for empty object", () => {
    expect(formatParamSummary({})).toBe("");
  });

  it("returns key names for up to 3 keys", () => {
    expect(formatParamSummary({ a: 1 })).toBe("a");
    expect(formatParamSummary({ a: 1, b: 2 })).toBe("a, b");
    expect(formatParamSummary({ x: 1, y: 2, z: 3 })).toBe("x, y, z");
  });

  it("truncates with ellipsis for more than 3 keys", () => {
    expect(formatParamSummary({ a: 1, b: 2, c: 3, d: 4 })).toBe("a, b, c, \u2026");
    expect(formatParamSummary({ w: 1, x: 2, y: 3, z: 4, q: 5 })).toBe("w, x, y, \u2026");
  });
});
