import {
  readDefaultDeckAccessToken,
  readStoredDeckAccessToken,
  writeStoredDeckAccessToken,
} from "./deck-auth-storage";
import { createDeckTransport } from "./deck-transport-core";

function readImportMetaEnv(name: string) {
  return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.[name];
}

function readDeckAccessToken() {
  return readStoredDeckAccessToken() ?? readDefaultDeckAccessToken();
}

const transport = createDeckTransport({
  readControlPlaneBase: () => readImportMetaEnv("VITE_DECK_GO_API_BASE"),
  readStoredToken: readDeckAccessToken,
  writeStoredToken: writeStoredDeckAccessToken,
});

export const deckFetch = transport.deckFetch;
export const deckStream = transport.deckStream;

export type { DeckEvent, DeckStreamOptions } from "./deck-transport-core";
