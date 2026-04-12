import { getEventBus } from "@server/event-bus";
/**
 * GET /api/activity — Recent activity events from EventBus memory buffer.
 *
 * Query params:
 *   - limit (optional, default 100, max 500)
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
  const { searchParams } = request.nextUrl;
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Math.max(1, parseInt(limitParam ?? "100", 10) || 100), 500);

  const bus = getEventBus();
  const { events: allEvents } = bus.getEventsSince(0);

  // Filter activity events and map to ActivityEvent shape.
  const events: ActivityEvent[] = allEvents
    .filter((e) => e.type === "activity.event")
    .map((e) => {
      const payload = e.data as Record<string, unknown>;
      return {
        id: (payload.id as string) ?? String(e.id),
        timestamp: typeof payload.timestamp === "number" ? payload.timestamp : e.timestamp,
        type: (payload.type as string) ?? "system",
        agentId: payload.agentId as string | undefined,
        agentName: payload.agentName as string | undefined,
        description: (payload.description as string) ?? "",
        details: payload.details as string | undefined,
      };
    })
    .slice(-limit)
    .reverse(); // Newest first.

  return NextResponse.json({ events });
});
