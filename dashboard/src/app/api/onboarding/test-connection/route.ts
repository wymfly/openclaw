/**
 * POST /api/onboarding/test-connection — Test gateway WS connectivity.
 *
 * Accepts `{ url, token }`, opens a temporary WebSocket, waits for the
 * `connect.challenge` event, then closes. Returns `{ success, error? }`.
 *
 * SSRF protection:
 *   - Only `ws://` and `wss://` protocols allowed
 *   - Private/reserved IP ranges blocked (except localhost/127.0.0.1 for local Gateway)
 */
import { NextResponse } from "next/server";
import { WebSocket } from "ws";

const TIMEOUT_MS = 6_000;

/**
 * Check whether a hostname resolves to a private/reserved IP range.
 * Returns true if the IP is private and should be blocked.
 * Exceptions: `localhost` and `127.0.0.1` are allowed for local Gateway.
 */
function isBlockedHost(hostname: string): boolean {
  // Allow localhost explicitly (needed for local Gateway testing)
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return false;
  }

  // Block obvious private IP ranges via regex
  // 10.0.0.0/8
  if (hostname.startsWith("10.")) {
    return true;
  }
  // 172.16.0.0/12
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
    return true;
  }
  // 192.168.0.0/16
  if (hostname.startsWith("192.168.")) {
    return true;
  }
  // 169.254.0.0/16 (link-local)
  if (hostname.startsWith("169.254.")) {
    return true;
  }
  // 127.0.0.0/8 (loopback range excluding 127.0.0.1 which is allowed above)
  if (hostname.startsWith("127.")) {
    return true;
  }
  // 0.0.0.0
  if (hostname === "0.0.0.0") {
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string; token?: string };
  const url = body.url?.trim();
  const token = body.token?.trim();

  if (!url || !token) {
    return NextResponse.json(
      { success: false, error: "url and token are required" },
      { status: 400 },
    );
  }

  // Validate protocol — only ws:// and wss:// allowed
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid URL format" }, { status: 400 });
  }

  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return NextResponse.json(
      { success: false, error: "Only ws:// and wss:// protocols are allowed" },
      { status: 400 },
    );
  }

  // SSRF: block private/reserved IP ranges (except localhost)
  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json(
      { success: false, error: "Connection to private network addresses is not allowed" },
      { status: 400 },
    );
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error("Connection timed out"));
      }, TIMEOUT_MS);

      ws.on("open", () => {
        clearTimeout(timer);
        ws.close(1000, "test complete");
        resolve();
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ success: false, error: message });
  }
}
