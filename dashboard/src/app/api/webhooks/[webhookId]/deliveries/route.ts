import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
/**
 * GET /api/webhooks/:webhookId/deliveries — List delivery history.
 *
 * Local SQLite only — no Gateway RPC.
 */
import { withAuth } from "@/lib/with-auth";

interface DeliveryRow {
  id: string;
  webhook_id: string;
  event_type: string;
  status_code: number | null;
  error: string | null;
  duration_ms: number | null;
  success: number;
  is_retry: number;
  created_at: string;
}

type RouteContext = { params: Promise<{ webhookId: string }> };

export const GET = withAuth(async (_req: NextRequest, ctx: unknown) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { webhookId } = await (ctx as RouteContext).params;

  const rows = runtime.db
    .prepare(
      `SELECT id, webhook_id, event_type, status_code, error, duration_ms, success, is_retry, created_at
       FROM webhook_deliveries
       WHERE webhook_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    .all(webhookId) as unknown as DeliveryRow[];

  const deliveries = rows.map((row) => ({
    id: row.id,
    webhookId: row.webhook_id,
    eventType: row.event_type,
    statusCode: row.status_code,
    error: row.error,
    durationMs: row.duration_ms,
    success: row.success === 1,
    isRetry: row.is_retry === 1,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ deliveries });
});
