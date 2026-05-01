const DECK_ACCESS_TOKEN_STORAGE_KEY = "deckGoAccessToken";

export function readStoredDeckAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(DECK_ACCESS_TOKEN_STORAGE_KEY);
}

export function writeStoredDeckAccessToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(DECK_ACCESS_TOKEN_STORAGE_KEY, token);
    return;
  }
  window.localStorage.removeItem(DECK_ACCESS_TOKEN_STORAGE_KEY);
}

/**
 * Returns a default access token from `VITE_DECK_GO_ACCESS_TOKEN` only when the
 * build was explicitly opted in via `VITE_DECK_GO_AUTO_UNLOCK=1`. Production
 * builds shipped to end users must NOT export the auto-unlock flag (the token
 * itself becomes bundle-visible once inlined by Vite). The launcher script
 * `scripts/dev/run-stack-real.sh` toggles both vars together for local dev/E2E.
 */
export function readDefaultDeckAccessToken(): string | null {
  const meta = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  if (!meta || meta.VITE_DECK_GO_AUTO_UNLOCK !== "1") {
    return null;
  }
  const candidate = meta.VITE_DECK_GO_ACCESS_TOKEN;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}
