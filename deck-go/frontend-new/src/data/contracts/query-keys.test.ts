import { describe, expect, it } from "vitest";
import { DEFAULT_RUNTIME_ID } from "../../lib/runtime-id";
import { deckKeys } from "./query-keys";

describe("Data Fabric query keys", () => {
  it("uses stable runtime scope prefixes", () => {
    expect(deckKeys.runtime.bootstrap()).toEqual([
      "deck-go",
      "runtime",
      DEFAULT_RUNTIME_ID,
      "bootstrap",
    ]);
    expect(deckKeys.runtime.gateway({ runtimeId: "rt_remote" })).toEqual([
      "deck-go",
      "runtime",
      "rt_remote",
      "gateway",
    ]);
  });

  it("normalizes filter objects for stable serialization", () => {
    const left = deckKeys.sessions.list({ b: 2, a: 1, skip: undefined });
    const right = deckKeys.sessions.list({ a: 1, b: 2 });

    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
    expect(left).toEqual(right);
  });

  it("documents deterministic serialization for numeric-like filter keys", () => {
    const key = deckKeys.module.list("numeric-filters", {
      "10": "ten",
      "2": "two",
      "1": "one",
      alpha: "letter",
    });

    expect(JSON.stringify(key)).toContain('"1":"one","2":"two","10":"ten","alpha":"letter"');
  });

  it("includes representative domain keys without non-serializable values", () => {
    const keys = [
      deckKeys.agents.list({ status: "running" }),
      deckKeys.agents.detail("main"),
      deckKeys.skills.list({ agentId: "main" }),
      deckKeys.skills.detail("skill-a"),
      deckKeys.usage.sessions({ window: "24h" }),
    ];

    for (const key of keys) {
      expect(() => JSON.stringify(key)).not.toThrow();
      expect(JSON.parse(JSON.stringify(key))[0]).toBe("deck-go");
    }
  });
});
