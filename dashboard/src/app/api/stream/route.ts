/**
 * SSE stream endpoint for openclaw-deck.
 *
 * GET /api/stream — returns a Server-Sent Events stream.
 * Supports Last-Event-ID header for replay after reconnect.
 * Sends `: heartbeat\n\n` every 15 s to keep the connection alive.
 */
import { getEventBus } from "@server/event-bus";
import type { ServerEvent, ServerEventSubscriber } from "@server/event-bus";

const HEARTBEAT_INTERVAL_MS = 15_000;

function formatSSE(event: ServerEvent): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export function GET(request: Request): Response {
  const bus = getEventBus();
  const lastEventId = Number(request.headers.get("Last-Event-ID") ?? "0") || 0;
  const encoder = new TextEncoder();

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
      request.signal.addEventListener("abort", () => {
        bus.unsubscribe(onEvent);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
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
