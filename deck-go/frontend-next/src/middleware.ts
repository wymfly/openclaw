import { type NextRequest, NextResponse } from "next/server";

/**
 * Runtime reverse-proxy for plugin webhook paths.
 *
 * WeCom (and other channel plugins) register HTTP callback routes on Gateway,
 * which binds to loopback only. This middleware rewrites matching requests to
 * Gateway at runtime so the public Deck port can receive external callbacks
 * without exposing Gateway directly.
 *
 * Unlike next.config.ts rewrites (resolved at build time), middleware reads
 * DECK_GATEWAY_URL at request time — no rebuild needed when the port changes.
 */
export function middleware(request: NextRequest) {
  const gatewayWsUrl = process.env.DECK_GATEWAY_URL ?? "ws://localhost:18789";
  const gatewayHttpUrl = gatewayWsUrl.replace(/^ws(s)?:\/\//, "http$1://");
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, gatewayHttpUrl);
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ["/plugins/:path*", "/wecom/:path*"],
};
