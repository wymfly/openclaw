import { afterEach, describe, expect, it } from "vitest";
import { getDeckGoApiBase, resolveDeckGoApiPath } from "./deck-go-base";

describe("deck-go-base", () => {
  const originalDeckGoApiBase = process.env.DECK_GO_API_BASE;
  const originalPublicDeckGoApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    process.env.DECK_GO_API_BASE = originalDeckGoApiBase;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalPublicDeckGoApiBase;
  });

  it("prefers DECK_GO_API_BASE over NEXT_PUBLIC_DECK_GO_API_BASE for server-side callers", () => {
    process.env.DECK_GO_API_BASE = "http://127.0.0.1:19566/";
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528/";

    expect(getDeckGoApiBase()).toBe("http://127.0.0.1:19566");
  });

  it("uses only NEXT_PUBLIC_DECK_GO_API_BASE for browser-side callers", () => {
    process.env.DECK_GO_API_BASE = "http://127.0.0.1:19566/";
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528/";

    expect(getDeckGoApiBase("browser")).toBe("http://127.0.0.1:19528");
  });

  it("falls back to NEXT_PUBLIC_DECK_GO_API_BASE for server-side callers when needed", () => {
    delete process.env.DECK_GO_API_BASE;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528/";

    expect(getDeckGoApiBase()).toBe("http://127.0.0.1:19528");
  });

  it("resolves API paths against the normalized base", () => {
    process.env.DECK_GO_API_BASE = "http://127.0.0.1:19566/";

    expect(resolveDeckGoApiPath("/api/v1/settings")).toBe("http://127.0.0.1:19566/api/v1/settings");
    expect(resolveDeckGoApiPath("api/v1/settings")).toBe("http://127.0.0.1:19566/api/v1/settings");
  });

  it("returns null when no control-plane base is configured", () => {
    delete process.env.DECK_GO_API_BASE;
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

    expect(resolveDeckGoApiPath("/api/v1/settings")).toBeNull();
  });
});
