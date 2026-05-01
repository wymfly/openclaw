import { beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(loadBlockPreferences()).toEqual({
      showThinking: true,
      showToolUse: true,
      showToolResult: true,
    });
  });

  it("loads valid preferences", () => {
    mockStorage.set(
      "deck:blockFilters",
      JSON.stringify({ showThinking: false, showToolUse: true, showToolResult: false }),
    );

    expect(loadBlockPreferences()).toEqual({
      showThinking: false,
      showToolUse: true,
      showToolResult: false,
    });
  });

  it("rejects non-boolean values and falls back to defaults", () => {
    mockStorage.set(
      "deck:blockFilters",
      JSON.stringify({ showThinking: "yes", showToolUse: 42, showToolResult: null }),
    );

    expect(loadBlockPreferences()).toEqual({
      showThinking: true,
      showToolUse: true,
      showToolResult: true,
    });
  });

  it("keeps valid partial values and defaults invalid or missing values", () => {
    mockStorage.set(
      "deck:blockFilters",
      JSON.stringify({ showThinking: false, showToolUse: "bad" }),
    );

    expect(loadBlockPreferences()).toEqual({
      showThinking: false,
      showToolUse: true,
      showToolResult: true,
    });
  });

  it("handles corrupted or non-object JSON", () => {
    mockStorage.set("deck:blockFilters", "not-json{{{");
    expect(loadBlockPreferences()).toEqual({
      showThinking: true,
      showToolUse: true,
      showToolResult: true,
    });

    mockStorage.set("deck:blockFilters", "[1,2,3]");
    expect(loadBlockPreferences()).toEqual({
      showThinking: true,
      showToolUse: true,
      showToolResult: true,
    });
  });

  it("roundtrips save and load", () => {
    const prefs = { showThinking: false, showToolUse: true, showToolResult: false };

    saveBlockPreferences(prefs);

    expect(loadBlockPreferences()).toEqual(prefs);
  });
});
