import { getRuntime } from "@server/runtime";
/**
 * GET /api/activity — Recent activity events from the projection store outbox.
 *
 * Query params:
 *   - limit (optional, default 100, max 500)
 *   - since (optional): outbox ID to read events after
 *
 * Returns: { events: ActivityEvent[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type ActivityEvent = {
  id: string;
  timestamp: number;
  type: string;
  agentId?: string;
  agentName?: string;
  description: string;
  details?: string;
};

export const GET = withAuth(async (request: NextRequest) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const limitParam = searchParams.get("limit");
  const sinceParam = searchParams.get("since");

  const limit = Math.min(Math.max(1, parseInt(limitParam ?? "100", 10) || 100), 500);
  const since = parseInt(sinceParam ?? "0", 10) || 0;

  try {
    const outboxEntries = runtime.store.getEventsSince(since, limit);

    // Map outbox entries into ActivityEvent shape.
    const events: ActivityEvent[] = outboxEntries
      .filter((entry) => entry.eventType === "activity.event")
      .map((entry) => {
        const payload = entry.payload as Record<string, unknown>;
        return {
          id: (payload.id as string) ?? String(entry.id),
          timestamp:
            typeof payload.timestamp === "number"
              ? payload.timestamp
              : new Date(entry.createdAt).getTime(),
          type: (payload.type as string) ?? "system",
          agentId: payload.agentId as string | undefined,
          agentName: payload.agentName as string | undefined,
          description: (payload.description as string) ?? "",
          details: payload.details as string | undefined,
        };
      })
      .toReversed(); // Newest first.

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
});
