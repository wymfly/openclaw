/**
 * POST /api/channels/[channelId]/test — Send a test message through a channel.
 *
 * Probes the channel and returns a synthetic test result.
 * Uses channels.status with probe=true to verify connectivity.
 */
import { type NextRequest, NextResponse } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ channelId: string }> };

export const POST = withAuth(async (request: NextRequest, ctx: unknown) => {
  const { channelId } = await (ctx as RouteContext).params;
  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const start = Date.now();

  try {
    // Use probe to verify connectivity
    const probeRes = await gwRequest("channels.status", { probe: true });
    const latencyMs = Date.now() - start;

    // gwRequest returns NextResponse — extract the JSON body
    let probeData: Record<string, unknown> | null = null;
    if (probeRes instanceof NextResponse) {
      probeData = (await probeRes.json().catch(() => null)) as Record<string, unknown> | null;
    } else if (probeRes && typeof probeRes === "object") {
      probeData = probeRes as Record<string, unknown>;
    }

    const channels = (probeData?.channels ?? probeData) as Record<string, unknown> | null;
    const channelStatus = channels?.[channelId];

    if (channelStatus) {
      return NextResponse.json({
        ok: true,
        messageId: `test-${Date.now()}`,
        channelId,
        message: body.message ?? "Test message",
        latencyMs,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Channel ${channelId} not responding`, latencyMs },
      { status: 502 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Test failed",
        latencyMs: Date.now() - start,
      },
      { status: 500 },
    );
  }
});
