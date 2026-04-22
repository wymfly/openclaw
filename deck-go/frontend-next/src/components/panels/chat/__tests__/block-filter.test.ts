import { beforeEach, describe, it, expect, vi } from "vitest";
import { loadBlockPreferences, saveBlockPreferences } from "@/stores/chat-preferences";

/* Minimal localStorage stub for Node/vitest (no jsdom needed) */
const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
  get length() {
    return storage.size;
  },
  key: (_index: number) => null,
};

vi.stubGlobal("localStorage", localStorageStub);

describe("ChatBlockPreferences", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("returns defaults when no localStorage", () => {
    const prefs = loadBlockPreferences();
    expect(prefs.showThinking).toBe(true);
    expect(prefs.showToolUse).toBe(true);
    expect(prefs.showToolResult).toBe(true);
  });

  it("round-trips through localStorage", () => {
    const prefs = { showThinking: false, showToolUse: true, showToolResult: false };
    saveBlockPreferences(prefs);
    expect(loadBlockPreferences()).toEqual(prefs);
  });
});
