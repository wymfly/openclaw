/**
 * GET /api/logs/stream — Server-Sent Events stream for log tailing.
 *
 * Replaces client-side polling by polling `logs.tail` server-side every 1 s
 * and pushing batches to all connected clients via SSE.
 *
 * Supports `Last-Event-ID` header for reconnection (cursor resume).
 */
import { validateRequest } from "@server/access-gate";
import { getRuntime } from "@server/runtime";
import { gwCall } from "@/lib/api-helpers";

const POLL_INTERVAL_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 15_000;

function extractAuthHeaders(request: Request): Record<string, string | undefined> {
  return {
    authorization: request.headers.get("authorization") ?? undefined,
    "x-deck-token": request.headers.get("x-deck-token") ?? undefined,
  };
}

export function GET(request: Request): Response {
  const runtime = getRuntime();
  const auth = validateRequest(extractAuthHeaders(request));
  if (!auth.valid) {
    return Response.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const lastEventId = request.headers.get("Last-Event-ID");
  let cursor: number | null = lastEventId !== null ? parseInt(lastEventId, 10) : null;
  if (cursor !== null && Number.isNaN(cursor)) {
    cursor = null;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let cleanedUp = false;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (cleanedUp) {
          return;
        }
        cleanedUp = true;
        if (pollTimer) {
          clearInterval(pollTimer);
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      const poll = async () => {
        if (cleanedUp) {
          return;
        }
        try {
          const data = await gwCall("logs.tail", {
            ...(cursor !== null ? { cursor } : {}),
            limit: 500,
            maxBytes: 65536,
          });

          if (typeof data.cursor === "number") {
            cursor = data.cursor;
          }
          if (data.reset) {
            cursor = null;
          }

          // Emit reset event when Gateway signals log rotation (even with 0 lines).
          if (data.reset) {
            try {
              controller.enqueue(encoder.encode("event: log.reset\ndata: {}\n\n"));
            } catch {
              cleanup();
              return;
            }
          }

          const lines = data.lines;
          if (Array.isArray(lines) && lines.length > 0) {
            const payload = JSON.stringify({
              lines,
              cursor: data.cursor,
            });
            try {
              controller.enqueue(
                encoder.encode(`id: ${data.cursor ?? 0}\nevent: log.batch\ndata: ${payload}\n\n`),
              );
            } catch {
              cleanup();
            }
          }
        } catch {
          // Gateway unavailable — skip this poll cycle.
        }
      };

      // Initial poll immediately.
      void poll();

      // Periodic poll every 1 s.
      pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);

      // Heartbeat every 15 s to keep the connection alive.
      heartbeatTimer = setInterval(() => {
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
