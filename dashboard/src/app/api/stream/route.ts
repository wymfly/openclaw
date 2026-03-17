/**
 * SSE stream endpoint for openclaw-deck.
 *
 * GET /api/stream — returns a Server-Sent Events stream.
 * Supports Last-Event-ID header for replay after reconnect.
 * Sends `: heartbeat\n\n` every 15 s to keep the connection alive.
 *
 * Security:
 *   - Maximum 50 concurrent SSE connections (returns 503 if exceeded)
 *   - No auth required (SSE is used by the onboarding flow too)
 */
import { getEventBus } from "@server/event-bus";
import type { ServerEvent, ServerEventSubscriber } from "@server/event-bus";

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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export function GET(request: Request): Response {
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
      // Replay missed events from the buffer.
      const missed = bus.getEventsSince(lastEventId);
      for (const event of missed) {
        controller.enqueue(encoder.encode(formatSSE(event)));
      }

      // Subscribe to live events.
      const onEvent: ServerEventSubscriber = (event) => {
        try {
          controller.enqueue(encoder.encode(formatSSE(event)));
        } catch {
          // Stream closed; cleanup will happen via cancel().
        }
      };
      bus.subscribe(onEvent);

      // Heartbeat keep-alive.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Cleanup when client disconnects.
      const cleanup = () => {
        bus.unsubscribe(onEvent);
        clearInterval(heartbeat);
        counter.count = Math.max(0, counter.count - 1);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      request.signal.addEventListener("abort", cleanup);
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
