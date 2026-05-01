import { readStoredDeckAccessToken, writeStoredDeckAccessToken } from "./deck-auth-storage";
import { createDeckTransport } from "./deck-transport-core";

function readImportMetaEnv(name: string) {
  return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.[name];
}

const transport = createDeckTransport({
  readControlPlaneBase: () => readImportMetaEnv("VITE_DECK_GO_API_BASE"),
  readStoredToken: readStoredDeckAccessToken,
  writeStoredToken: writeStoredDeckAccessToken,
});

export const deckFetch = transport.deckFetch;
export const deckStream = transport.deckStream;

export type { DeckEvent, DeckStreamOptions } from "./deck-transport-core";
