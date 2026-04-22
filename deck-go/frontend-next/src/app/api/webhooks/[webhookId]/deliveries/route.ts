import { NextRequest, NextResponse } from "next/server";
import { getDeliveryStore } from "@/lib/webhooks";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
/**
 * GET /api/webhooks/:webhookId/deliveries — List delivery history.
 *
 * JSON file storage via JsonStore.
 */
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ webhookId: string }> };

async function localWebhookDeliveriesGetHandler(_req: NextRequest, ctx: unknown) {
  const { webhookId } = await (ctx as RouteContext).params;
  const store = getDeliveryStore();

  const deliveries = store
    .get()
    .filter((d) => d.webhookId === webhookId)
    .toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);

  return NextResponse.json({ deliveries });
}

const guardedLocalWebhookDeliveriesGetHandler = withAuth(localWebhookDeliveriesGetHandler);

export async function GET(request: NextRequest, ctx: unknown) {
  const { webhookId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/webhooks/${encodeURIComponent(webhookId)}/deliveries`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalWebhookDeliveriesGetHandler(request, ctx);
}
