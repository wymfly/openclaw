import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadBlockPreferences, saveBlockPreferences } from "../chat-preferences";

describe("chat-preferences", () => {
  const mockStorage = new Map<string, string>();

  beforeEach(() => {
    mockStorage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, val: string) => mockStorage.set(key, val),
      removeItem: (key: string) => mockStorage.delete(key),
    });
  });

  it("returns defaults when nothing stored", () => {
    const prefs = loadBlockPreferences();
    expect(prefs).toEqual({ showThinking: true, showToolUse: true, showToolResult: true });
  });

  it("loads valid preferences", () => {
    mockStorage.set(
      "deck:blockFilters",
      JSON.stringify({ showThinking: false, showToolUse: true, showToolResult: false }),
    );
    const prefs = loadBlockPreferences();
    expect(prefs).toEqual({ showThinking: false, showToolUse: true, showToolResult: false });
  });

  it("rejects non-boolean values and falls back to defaults (C2)", () => {
    mockStorage.set(
      "deck:blockFilters",
      JSON.stringify({ showThinking: "yes", showToolUse: 42, showToolResult: null }),
    );
    const prefs = loadBlockPreferences();
    expect(prefs).toEqual({ showThinking: true, showToolUse: true, showToolResult: true });
  });

  it("handles partial valid data — keeps valid booleans, defaults invalid (C2)", () => {
    mockStorage.set(
      "deck:blockFilters",
      JSON.stringify({ showThinking: false, showToolUse: "bad" }),
    );
    const prefs = loadBlockPreferences();
    expect(prefs.showThinking).toBe(false);
    expect(prefs.showToolUse).toBe(true); // default
    expect(prefs.showToolResult).toBe(true); // default (missing)
  });

  it("handles corrupted JSON", () => {
    mockStorage.set("deck:blockFilters", "not-json{{{");
    const prefs = loadBlockPreferences();
    expect(prefs).toEqual({ showThinking: true, showToolUse: true, showToolResult: true });
  });

  it("handles non-object JSON (array)", () => {
    mockStorage.set("deck:blockFilters", "[1,2,3]");
    const prefs = loadBlockPreferences();
    expect(prefs).toEqual({ showThinking: true, showToolUse: true, showToolResult: true });
  });

  it("roundtrips save and load", () => {
    const prefs = { showThinking: false, showToolUse: true, showToolResult: false };
    saveBlockPreferences(prefs);
    expect(loadBlockPreferences()).toEqual(prefs);
  });
});
