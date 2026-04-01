import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
/**
 * GET /api/webhooks — List all webhooks.
 * POST /api/webhooks — Create a new webhook.
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

export const GET = withAuth(async () => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const rows = runtime.db
    .prepare("SELECT * FROM webhooks ORDER BY created_at DESC")
    .all() as unknown as WebhookRow[];

  return NextResponse.json({ webhooks: rows.map(rowToWebhook) });
});

export const POST = withAuth(async (req: NextRequest) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

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

  const id = crypto.randomUUID();
  const events = JSON.stringify(body.events ?? []);
  const enabled = body.enabled !== false ? 1 : 0;

  runtime.db
    .prepare(
      `INSERT INTO webhooks (id, name, url, secret, events, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, body.name, body.url, body.secret ?? null, events, enabled);

  const row = runtime.db
    .prepare("SELECT * FROM webhooks WHERE id = ?")
    .get(id) as unknown as WebhookRow;

  return NextResponse.json(rowToWebhook(row), { status: 201 });
});
