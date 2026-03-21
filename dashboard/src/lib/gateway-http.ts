/**
 * Resolve the Gateway HTTP base URL and auth token.
 *
 * Priority: DECK_GATEWAY_URL env > DB settings (via runtime store).
 * WS URLs are converted to HTTP (ws:// → http://, wss:// → https://).
 */

import { getRuntime } from "@server/runtime";

function wsToHttp(url: string): string {
  return url.replace(/^ws(s?):\/\//, "http$1://");
}

export function getGatewayHttpUrl(): string | null {
  const envUrl = process.env.DECK_GATEWAY_URL ?? null;
  if (envUrl) {
    return wsToHttp(envUrl);
  }

  const runtime = getRuntime();
  const dbUrl = runtime?.store?.getSetting("gateway_url") ?? null;
  if (dbUrl) {
    return wsToHttp(dbUrl);
  }

  return null;
}

export function getGatewayToken(): string | null {
  const envToken = process.env.DECK_GATEWAY_TOKEN ?? null;
  if (envToken) {
    return envToken;
  }

  const runtime = getRuntime();
  return runtime?.store?.getSetting("gateway_token") ?? null;
}
