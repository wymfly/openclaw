import { NextRequest, NextResponse } from "next/server";
import { getDeliveryStore } from "@/lib/webhooks";
/**
 * GET /api/webhooks/:webhookId/deliveries — List delivery history.
 *
 * JSON file storage via JsonStore.
 */
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ webhookId: string }> };

export const GET = withAuth(async (_req: NextRequest, ctx: unknown) => {
  const { webhookId } = await (ctx as RouteContext).params;
  const store = getDeliveryStore();

  const deliveries = store
    .get()
    .filter((d) => d.webhookId === webhookId)
    .toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);

  return NextResponse.json({ deliveries });
});
