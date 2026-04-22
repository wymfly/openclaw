import { createDeckTransport } from "../../../frontend/src/lib/deck-transport-core";

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
  readControlPlaneBase: () => process.env.NEXT_PUBLIC_DECK_GO_API_BASE,
  readStoredToken,
  writeStoredToken,
});

export const deckFetch = transport.deckFetch;
export const deckStream = transport.deckStream;
