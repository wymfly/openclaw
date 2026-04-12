/**
 * Resolve the Gateway HTTP base URL and auth token.
 *
 * Priority: DECK_GATEWAY_URL env > JSON settings store.
 * WS URLs are converted to HTTP (ws:// → http://, wss:// → https://).
 */

import { getSetting } from "@server/deck-settings";

function wsToHttp(url: string): string {
  return url.replace(/^ws(s?):\/\//, "http$1://");
}

export function getGatewayHttpUrl(): string | null {
  const envUrl = process.env.DECK_GATEWAY_URL ?? null;
  if (envUrl) {
    return wsToHttp(envUrl);
  }

  const storeUrl = getSetting("gateway_url") ?? null;
  if (storeUrl) {
    return wsToHttp(storeUrl);
  }

  return null;
}

export function getGatewayToken(): string | null {
  const envToken = process.env.DECK_GATEWAY_TOKEN ?? null;
  if (envToken) {
    return envToken;
  }

  return getSetting("gateway_token") ?? null;
}
