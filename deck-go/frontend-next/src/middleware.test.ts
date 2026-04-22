import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { config, middleware } from "./middleware";

describe("frontend-next middleware", () => {
  const originalGatewayUrl = process.env.DECK_GATEWAY_URL;

  afterEach(() => {
    process.env.DECK_GATEWAY_URL = originalGatewayUrl;
  });

  it("rewrites plugin webhook callbacks to the default loopback Gateway over http", () => {
    delete process.env.DECK_GATEWAY_URL;

    const response = middleware(new NextRequest("http://localhost/plugins/wecom/callback?sig=1"));

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:18789/plugins/wecom/callback?sig=1",
    );
  });

  it("rewrites webhook callbacks using https when DECK_GATEWAY_URL is secure websocket", () => {
    process.env.DECK_GATEWAY_URL = "wss://gateway.example.test:9443";

    const response = middleware(new NextRequest("http://localhost/wecom/callback?msg=ok"));

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://gateway.example.test:9443/wecom/callback?msg=ok",
    );
  });

  it("keeps the ingress matcher bounded to the retained plugin callback paths", () => {
    expect(config.matcher).toEqual(["/plugins/:path*", "/wecom/:path*"]);
  });
});
