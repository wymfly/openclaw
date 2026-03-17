import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { deliverWebhook, type Webhook } from "@/lib/webhooks";
/**
 * POST /api/webhooks/:webhookId/test — Send a test delivery.
 *
 * Local SQLite only — uses deliverWebhook() from lib/webhooks.ts.
 */
import { withAuth } from "@/lib/with-auth";

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string;
  enabled: number;
  consecutive_failures: number;
}

type RouteContext = { params: Promise<{ webhookId: string }> };

export const POST = withAuth(async (_req: NextRequest, ctx: unknown) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { webhookId } = await (ctx as RouteContext).params;

  const row = runtime.db
    .prepare(
      "SELECT id, name, url, secret, events, enabled, consecutive_failures FROM webhooks WHERE id = ?",
    )
    .get(webhookId) as WebhookRow | undefined;

  if (!row) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const webhook: Webhook = {
    id: row.id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    events: row.events,
    enabled: row.enabled,
    consecutive_failures: row.consecutive_failures,
  };

  const result = await deliverWebhook(
    runtime.db,
    webhook,
    "test.ping",
    { test: true },
    { allowRetry: false },
  );

  return NextResponse.json({
    success: result.success,
    statusCode: result.statusCode,
    durationMs: result.durationMs,
    error: result.error,
    deliveryId: result.deliveryId,
  });
});
