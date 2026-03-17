/**
 * POST /api/settings/test-connection — Test WebSocket connection to a gateway.
 *
 * Body: { url: string, token: string }
 * Response: { ok: boolean, error?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as Record<string, unknown>;
  const url = body.url as string | undefined;
  const token = body.token as string | undefined;

  if (!url) {
    return NextResponse.json({ ok: false, error: "Gateway URL is required" });
  }

  try {
    // Validate URL format
    const wsUrl = new URL(url);
    if (!["ws:", "wss:"].includes(wsUrl.protocol)) {
      return NextResponse.json({ ok: false, error: "URL must use ws:// or wss:// protocol" });
    }

    // Attempt a basic HTTP health check on the gateway's HTTP endpoint.
    // Most WS gateways also serve HTTP on the same port.
    const httpUrl = url.replace(/^ws/, "http");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(httpUrl, {
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      clearTimeout(timeout);
      // Any response (even 401/403) means the server is reachable
      return NextResponse.json({ ok: true });
    } catch (fetchErr) {
      clearTimeout(timeout);
      const message = fetchErr instanceof Error ? fetchErr.message : "Connection failed";
      return NextResponse.json({ ok: false, error: message });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid URL format" });
  }
});
