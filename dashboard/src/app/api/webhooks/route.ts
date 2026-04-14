import { NextRequest, NextResponse } from "next/server";
import { getWebhookStore, type Webhook } from "@/lib/webhooks";
/**
 * GET /api/webhooks — List all webhooks.
 * POST /api/webhooks — Create a new webhook.
 *
 * JSON file storage via JsonStore.
 */
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  const store = getWebhookStore();
  const webhooks = [...store.get()].toSorted(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return NextResponse.json({ webhooks });
});

export const POST = withAuth(async (req: NextRequest) => {
  const body = (await req.json()) as {
    name?: string;
    url?: string;
    secret?: string;
    events?: string[];
    enabled?: boolean;
  };

  if (!body.name || !body.url) {
    return NextResponse.json({ error: "name and url are required" }, { status: 400 });
  }

  // Basic URL validation
  try {
    new URL(body.url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const webhook: Webhook = {
    id: crypto.randomUUID(),
    name: body.name,
    url: body.url,
    secret: body.secret ?? null,
    events: body.events ?? [],
    enabled: body.enabled !== false,
    consecutiveFailures: 0,
    lastFiredAt: null,
    lastStatus: null,
    createdAt: now,
    updatedAt: now,
  };

  getWebhookStore().append(webhook);
  return NextResponse.json(webhook, { status: 201 });
});
