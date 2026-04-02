import { validateRequest, type AccessGateDb } from "@server/access-gate";
import { getEventBus } from "@server/event-bus";
import type { ServerEvent, ServerEventSubscriber } from "@server/event-bus";
/**
 * SSE stream endpoint for openclaw-deck.
 *
 * GET /api/stream — returns a Server-Sent Events stream.
 * Supports Last-Event-ID header for replay after reconnect.
 * Sends `: heartbeat\n\n` every 15 s to keep the connection alive.
 *
 * Reconnection strategy:
 *   The browser's native EventSource API handles automatic reconnection
 *   with a default retry interval (~3 s in most browsers). The server may
 *   override this by sending a `retry: <ms>` field. After a 503 (connection
 *   limit), the response includes a `Retry-After: 5` header as a hint to
 *   the client. The `Last-Event-ID` header on reconnection enables the
 *   server to replay any events the client missed from the in-memory ring
 *   buffer (see `getEventsSince`).
 *
 *   For custom SSE clients (non-EventSource), implement exponential backoff:
 *     baseDelay = 1000ms, factor = 2, maxDelay = 30000ms, jitter = +/-25%
 *     delay = min(baseDelay * factor^attempt, maxDelay) * (0.75 + Math.random() * 0.5)
 *     Reset attempt counter on successful connection (first data frame received).
 *
 * Security:
 *   - Maximum 50 concurrent SSE connections (returns 503 if exceeded)
 *   - Same Deck access-gate auth model as JSON routes
 */
import { getRuntime } from "@server/runtime";

const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_SSE_CONNECTIONS = 50;

// ---------------------------------------------------------------------------
// Global connection counter (survives HMR via globalThis)
// ---------------------------------------------------------------------------

const COUNTER_KEY = "__openclawDeckSSECounter__";

type SSECounter = { count: number };

function getSSECounter(): SSECounter {
  const g = globalThis as unknown as Record<string, SSECounter | undefined>;
  if (!g[COUNTER_KEY]) {
    g[COUNTER_KEY] = { count: 0 };
  }
  return g[COUNTER_KEY];
}

// ---------------------------------------------------------------------------
// SSE formatting
// ---------------------------------------------------------------------------

function formatSSE(event: ServerEvent): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

function extractAuthHeaders(request: Request): Record<string, string | undefined> {
  return {
    authorization: request.headers.get("authorization") ?? undefined,
    "x-deck-token": request.headers.get("x-deck-token") ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export function GET(request: Request): Response {
  const runtime = getRuntime();
  const db = runtime?.db as unknown as AccessGateDb | undefined;
  const auth = validateRequest(extractAuthHeaders(request), db);
  if (!auth.valid) {
    return Response.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const counter = getSSECounter();

  // Enforce connection limit
  if (counter.count >= MAX_SSE_CONNECTIONS) {
    return new Response(JSON.stringify({ error: "Too many SSE connections" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Retry-After": "5" },
    });
  }

  const bus = getEventBus();
  const lastEventId = Number(request.headers.get("Last-Event-ID") ?? "0") || 0;
  const encoder = new TextEncoder();

  counter.count += 1;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let cleanedUp = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let onEvent: ServerEventSubscriber | null = null;
      const cleanup = () => {
        if (cleanedUp) {
          return;
        }
        cleanedUp = true;
        if (onEvent) {
          bus.unsubscribe(onEvent);
        }
        if (heartbeat) {
          clearInterval(heartbeat);
        }
        counter.count = Math.max(0, counter.count - 1);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      // Replay missed events from the buffer.
      const missed = bus.getEventsSince(lastEventId);
      for (const event of missed) {
        controller.enqueue(encoder.encode(formatSSE(event)));
      }

      // Subscribe to live events.
      onEvent = (event) => {
        try {
          controller.enqueue(encoder.encode(formatSSE(event)));
        } catch {
          cleanup();
        }
      };
      bus.subscribe(onEvent);

      // Heartbeat keep-alive.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
