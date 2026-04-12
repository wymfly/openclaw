import { NextRequest, NextResponse } from "next/server";
import { deliverWebhook, getWebhookStore } from "@/lib/webhooks";
/**
 * POST /api/webhooks/:webhookId/test — Send a test delivery.
 *
 * JSON file storage — uses deliverWebhook() from lib/webhooks.ts.
 */
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ webhookId: string }> };

export const POST = withAuth(async (_req: NextRequest, ctx: unknown) => {
  const { webhookId } = await (ctx as RouteContext).params;

  const webhook = getWebhookStore().find((w) => w.id === webhookId);
  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const result = await deliverWebhook(
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
