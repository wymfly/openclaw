import { describe, expect, it } from "vitest";
import { detectConflicts } from "./detect-conflicts";

describe("detectConflicts", () => {
  it("returns empty array when bindings do not overlap", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      { id: "b", match: { channel: "discord" }, tier: "channel", agentId: "bot2" },
    ];

    expect(detectConflicts(bindings)).toEqual([]);
  });

  it("detects overlapping channel and peer rules across agents", () => {
    const bindings = [
      {
        id: "a",
        match: { channel: "telegram", peer: { kind: "direct", id: "123" } },
        tier: "peer",
        agentId: "bot1",
      },
      {
        id: "b",
        match: { channel: "telegram", peer: { kind: "direct", id: "123" } },
        tier: "peer",
        agentId: "bot2",
      },
    ];

    expect(detectConflicts(bindings)).toEqual([
      { bindingA: "a", bindingB: "b", overlapType: "exact" },
    ]);
  });

  it("does not flag same-agent overlap as conflict", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      { id: "b", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
    ];

    expect(detectConflicts(bindings)).toEqual([]);
  });

  it("detects subset overlap when one rule is broader", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      {
        id: "b",
        match: { channel: "telegram", peer: { kind: "direct", id: "123" } },
        tier: "peer",
        agentId: "bot2",
      },
    ];

    expect(detectConflicts(bindings)).toEqual([
      { bindingA: "a", bindingB: "b", overlapType: "subset" },
    ]);
  });

  it("ignores default tier bindings", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      { id: "b", match: {}, tier: "default", agentId: "bot2" },
    ];

    expect(detectConflicts(bindings)).toEqual([]);
  });

  it("checks teamId dimension before reporting overlap", () => {
    const bindings = [
      { id: "a", match: { channel: "slack", teamId: "T1" }, tier: "team", agentId: "bot1" },
      { id: "b", match: { channel: "slack", teamId: "T2" }, tier: "team", agentId: "bot2" },
    ];

    expect(detectConflicts(bindings)).toEqual([]);
  });
});
