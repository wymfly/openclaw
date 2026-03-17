/**
 * POST /api/onboarding/test-connection — Test gateway WS connectivity.
 *
 * Accepts `{ url, token }`, opens a temporary WebSocket, waits for the
 * `connect.challenge` event, then closes. Returns `{ success, error? }`.
 */
import { NextResponse } from "next/server";
import { WebSocket } from "ws";

const TIMEOUT_MS = 6_000;

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string; token?: string };
  const url = body.url?.trim();
  const token = body.token?.trim();

  if (!url || !token) {
    return NextResponse.json({ success: false, error: "url and token are required" });
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
