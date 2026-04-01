import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
/**
 * PATCH /api/webhooks/:webhookId — Update a webhook.
 * DELETE /api/webhooks/:webhookId — Delete a webhook.
 *
 * Local SQLite only — no Gateway RPC.
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
  last_fired_at: string | null;
  last_status: number | null;
  created_at: string;
  updated_at: string;
}

function rowToWebhook(row: WebhookRow) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    events: JSON.parse(row.events) as string[],
    enabled: row.enabled === 1,
    consecutiveFailures: row.consecutive_failures,
    lastFiredAt: row.last_fired_at,
    lastStatus: row.last_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type RouteContext = { params: Promise<{ webhookId: string }> };

export const PATCH = withAuth(async (req: NextRequest, ctx: unknown) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { webhookId } = await (ctx as RouteContext).params;

  const existing = runtime.db.prepare("SELECT id FROM webhooks WHERE id = ?").get(webhookId);
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

  // Build SET clause dynamically
  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    sets.push("name = ?");
    values.push(body.name);
  }
  if (body.url !== undefined) {
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    sets.push("url = ?");
    values.push(body.url);
  }
  if (body.secret !== undefined) {
    sets.push("secret = ?");
    values.push(body.secret);
  }
  if (body.events !== undefined) {
    sets.push("events = ?");
    values.push(JSON.stringify(body.events));
  }
  if (body.enabled !== undefined) {
    sets.push("enabled = ?");
    values.push(body.enabled ? 1 : 0);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  sets.push("updated_at = datetime('now')");
  values.push(webhookId);

  runtime.db.prepare(`UPDATE webhooks SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  const row = runtime.db
    .prepare("SELECT * FROM webhooks WHERE id = ?")
    .get(webhookId) as unknown as WebhookRow;
  return NextResponse.json(rowToWebhook(row));
});

export const DELETE = withAuth(async (_req: NextRequest, ctx: unknown) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { webhookId } = await (ctx as RouteContext).params;

  const result = runtime.db.prepare("DELETE FROM webhooks WHERE id = ?").run(webhookId);
  if (result.changes === 0) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
});
