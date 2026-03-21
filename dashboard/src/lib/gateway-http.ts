/**
 * Resolve the Gateway HTTP base URL and auth token.
 * Reads from DECK_GATEWAY_URL (ws:// -> http://) and DECK_GATEWAY_TOKEN env vars.
 */

export function getGatewayHttpUrl(): string | null {
  const wsUrl = process.env.DECK_GATEWAY_URL ?? null;
  if (!wsUrl) {
    return null;
  }
  return wsUrl.replace(/^ws(s?):\/\//, "http$1://");
}

export function getGatewayToken(): string | null {
  return process.env.DECK_GATEWAY_TOKEN ?? null;
}
