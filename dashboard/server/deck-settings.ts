/**
 * Deck Settings — typed JSON persistence for gateway configuration.
 *
 * Replaces `ProjectionStore.getSetting/setSetting` (SQLite settings table).
 * Stores gateway_url, gateway_token, notification_prefs, access_token, etc.
 *
 * Uses globalThis singleton (HMR-safe) via `getJsonStore`.
 */
import { getJsonStore, type JsonStore } from "./json-store";

// ---------------------------------------------------------------------------
// Store accessor
// ---------------------------------------------------------------------------

const STORE_NAME = "deck-settings";

export function getDeckSettings(): JsonStore<Record<string, string>> {
  return getJsonStore<Record<string, string>>(STORE_NAME, {});
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function getSetting(key: string): string | undefined {
  return getDeckSettings().get()[key];
}

export function setSetting(key: string, value: string): void {
  getDeckSettings().update((current) => ({ ...current, [key]: value }));
}

export function deleteSetting(key: string): boolean {
  const store = getDeckSettings();
  const current = store.get();
  if (!(key in current)) {
    return false;
  }
  const { [key]: _, ...rest } = current;
  store.set(rest);
  return true;
}
