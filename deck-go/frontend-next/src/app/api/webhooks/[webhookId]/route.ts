import { NextRequest, NextResponse } from "next/server";
import { getWebhookStore } from "@/lib/webhooks";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
/**
 * PATCH /api/webhooks/:webhookId — Update a webhook.
 * DELETE /api/webhooks/:webhookId — Delete a webhook.
 *
 * JSON file storage via JsonStore.
 */
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ webhookId: string }> };

async function localWebhooksPatchHandler(req: NextRequest, ctx: unknown) {
  const { webhookId } = await (ctx as RouteContext).params;
  const store = getWebhookStore();

  const existing = store.find((w) => w.id === webhookId);
  if (!existing) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    name?: string;
    url?: string;
    secret?: string | null;
    events?: string[];
    enabled?: boolean;
  };

  if (body.url !== undefined) {
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  const hasUpdate =
    body.name !== undefined ||
    body.url !== undefined ||
    body.secret !== undefined ||
    body.events !== undefined ||
    body.enabled !== undefined;

  if (!hasUpdate) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  store.updateItem(
    (w) => w.id === webhookId,
    (w) => ({
      ...w,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.url !== undefined && { url: body.url }),
      ...(body.secret !== undefined && { secret: body.secret }),
      ...(body.events !== undefined && { events: body.events }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      updatedAt: new Date().toISOString(),
    }),
  );

  const updated = store.find((w) => w.id === webhookId);
  return NextResponse.json(updated);
}

async function localWebhooksDeleteHandler(_req: NextRequest, ctx: unknown) {
  const { webhookId } = await (ctx as RouteContext).params;
  const removed = getWebhookStore().removeWhere((w) => w.id === webhookId);
  if (removed === 0) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}

const guardedLocalWebhooksPatchHandler = withAuth(localWebhooksPatchHandler);
const guardedLocalWebhooksDeleteHandler = withAuth(localWebhooksDeleteHandler);

export async function PATCH(request: NextRequest, ctx: unknown) {
  const { webhookId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(request, `/api/v1/webhooks/${encodeURIComponent(webhookId)}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalWebhooksPatchHandler(request, ctx);
}

export async function DELETE(request: NextRequest, ctx: unknown) {
  const { webhookId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(request, `/api/v1/webhooks/${encodeURIComponent(webhookId)}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalWebhooksDeleteHandler(request, ctx);
}
