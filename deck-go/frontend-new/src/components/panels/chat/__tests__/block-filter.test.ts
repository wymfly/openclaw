import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadBlockPreferences, saveBlockPreferences } from "@/stores/chat-preferences";

const storage = new Map<string, string>();

vi.stubGlobal("localStorage", {
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
  key: () => null,
});

describe("ChatBlockPreferences", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("returns defaults when no localStorage preference exists", () => {
    expect(loadBlockPreferences()).toEqual({
      showThinking: true,
      showToolUse: true,
      showToolResult: true,
    });
  });

  it("round-trips through localStorage", () => {
    const prefs = { showThinking: false, showToolUse: true, showToolResult: false };

    saveBlockPreferences(prefs);

    expect(loadBlockPreferences()).toEqual(prefs);
  });
});
