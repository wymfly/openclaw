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

export function persistStoredDeckAccessToken(token: string | null) {
  writeStoredDeckAccessToken(token);
  return token;
}
