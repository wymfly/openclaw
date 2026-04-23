import { createDeckTransport } from "./deck-transport-core";

function readImportMetaEnv(name: string) {
  return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.[name];
}

function readProcessEnv(name: string) {
  return (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.[name];
}

function readStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem("deckGoAccessToken");
}

function writeStoredToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem("deckGoAccessToken", token);
    return;
  }
  window.localStorage.removeItem("deckGoAccessToken");
}

const transport = createDeckTransport({
  readControlPlaneBase: () =>
    readImportMetaEnv("VITE_DECK_GO_API_BASE") ?? readProcessEnv("VITE_DECK_GO_API_BASE"),
  readStoredToken,
  writeStoredToken,
});

export const deckFetch = transport.deckFetch;
export const deckStream = transport.deckStream;
export const persistDeckAccessToken = transport.persistDeckAccessToken;

export type { DeckEvent, DeckStreamOptions } from "./deck-transport-core";
