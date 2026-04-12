import { NextRequest, NextResponse } from "next/server";
/**
 * GET /api/webhooks/:webhookId/deliveries — List delivery history.
 *
 * JSON file storage via JsonStore.
 */
import { withAuth } from "@/lib/with-auth";
import { getDeliveryStore } from "@/lib/webhooks";

type RouteContext = { params: Promise<{ webhookId: string }> };

export const GET = withAuth(async (_req: NextRequest, ctx: unknown) => {
  const { webhookId } = await (ctx as RouteContext).params;
  const store = getDeliveryStore();

  const deliveries = store
    .get()
    .filter((d) => d.webhookId === webhookId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);

  return NextResponse.json({ deliveries });
});
