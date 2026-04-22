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
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

type ActivityEvent = {
  id: string;
  timestamp: number;
  type: string;
  agentId?: string;
  agentName?: string;
  description: string;
  details?: string;
};

async function localActivityGetHandler(request: NextRequest) {
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
    .toReversed(); // Newest first.

  return NextResponse.json({ events });
}

const guardedLocalActivityGetHandler = withAuth(localActivityGetHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/activity${search}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { events?: ActivityEvent[] };
    return NextResponse.json({ events: payload.events ?? [] });
  }
  return guardedLocalActivityGetHandler(request);
}
