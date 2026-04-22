import { NextRequest, NextResponse } from "next/server";
import { deliverWebhook, getWebhookStore } from "@/lib/webhooks";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
/**
 * POST /api/webhooks/:webhookId/test — Send a test delivery.
 *
 * JSON file storage — uses deliverWebhook() from lib/webhooks.ts.
 */
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ webhookId: string }> };

async function localWebhookTestPostHandler(_req: NextRequest, ctx: unknown) {
  const { webhookId } = await (ctx as RouteContext).params;

  const webhook = getWebhookStore().find((w) => w.id === webhookId);
  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const result = await deliverWebhook(webhook, "test.ping", { test: true }, { allowRetry: false });

  return NextResponse.json({
    success: result.success,
    statusCode: result.statusCode,
    durationMs: result.durationMs,
    error: result.error,
    deliveryId: result.deliveryId,
  });
}

const guardedLocalWebhookTestPostHandler = withAuth(localWebhookTestPostHandler);

export async function POST(request: NextRequest, ctx: unknown) {
  const { webhookId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/webhooks/${encodeURIComponent(webhookId)}/test`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalWebhookTestPostHandler(request, ctx);
}
