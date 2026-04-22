import { afterEach, describe, expect, it } from "vitest";
import { getJsonStore } from "./json-store";

describe("json-store", () => {
  const originalDeckDataDir = process.env.DECK_DATA_DIR;

  afterEach(() => {
    process.env.DECK_DATA_DIR = originalDeckDataDir;
  });

  it("reuses the same singleton for the same store name", () => {
    process.env.DECK_DATA_DIR = `/tmp/deck-go-json-store-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const first = getJsonStore("singleton-check", { count: 1 });
    const second = getJsonStore("singleton-check", { count: 999 });

    expect(second).toBe(first);
    expect(second.get()).toEqual({ count: 1 });
  });

  it("persists and reloads array store mutations", () => {
    process.env.DECK_DATA_DIR = `/tmp/deck-go-json-store-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const store = getJsonStore<string[]>("array-check", []);
    store.set([]);
    store.append("a");
    store.append("b");
    store.reload();

    expect(store.get()).toEqual(["a", "b"]);
  });
});
