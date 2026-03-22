import { describe, it, expect } from "vitest";
import { detectConflicts } from "./detect-conflicts";

describe("detectConflicts", () => {
  it("returns empty array when no conflicts", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      { id: "b", match: { channel: "discord" }, tier: "channel", agentId: "bot2" },
    ];
    expect(detectConflicts(bindings)).toEqual([]);
  });

  it("detects overlapping channel+peer rules", () => {
    const bindings = [
      {
        id: "a",
        match: { channel: "telegram", peer: { kind: "user", id: "123" } },
        tier: "peer",
        agentId: "bot1",
      },
      {
        id: "b",
        match: { channel: "telegram", peer: { kind: "user", id: "123" } },
        tier: "peer",
        agentId: "bot2",
      },
    ];
    const result = detectConflicts(bindings);
    expect(result).toHaveLength(1);
    expect(result[0].bindingA).toBe("a");
    expect(result[0].bindingB).toBe("b");
  });

  it("does not flag same-agent overlap as conflict", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      { id: "b", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
    ];
    expect(detectConflicts(bindings)).toEqual([]);
  });

  it("detects subset overlap (specific is subset of broad)", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      {
        id: "b",
        match: { channel: "telegram", peer: { kind: "user", id: "123" } },
        tier: "peer",
        agentId: "bot2",
      },
    ];
    const result = detectConflicts(bindings);
    expect(result).toHaveLength(1);
  });

  it("handles empty bindings", () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it("handles single binding", () => {
    expect(
      detectConflicts([
        { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      ]),
    ).toEqual([]);
  });

  it("does not flag default tier as conflict", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      { id: "b", match: {}, tier: "default", agentId: "bot2" },
    ];
    expect(detectConflicts(bindings)).toEqual([]);
  });

  it("checks teamId dimension", () => {
    const bindings = [
      { id: "a", match: { channel: "slack", teamId: "T1" }, tier: "team", agentId: "bot1" },
      { id: "b", match: { channel: "slack", teamId: "T2" }, tier: "team", agentId: "bot2" },
    ];
    expect(detectConflicts(bindings)).toEqual([]);
  });
});
