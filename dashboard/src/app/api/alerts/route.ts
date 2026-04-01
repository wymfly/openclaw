/**
 * GET /api/alerts — List all alert rules from SQLite.
 * POST /api/alerts — Create a new alert rule.
 */
import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type AlertRuleRow = {
  id: string;
  name: string;
  entity_type: string;
  condition: string;
  threshold: number;
  action: string;
  cooldown_ms: number;
  last_fired_at: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
};

function mapRow(row: AlertRuleRow) {
  return {
    id: row.id,
    name: row.name,
    entityType: row.entity_type,
    condition: row.condition,
    threshold: row.threshold,
    action: row.action,
    cooldownMs: row.cooldown_ms,
    lastFiredAt: row.last_fired_at,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const GET = withAuth(async () => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  try {
    const rows = runtime.db
      .prepare("SELECT * FROM alert_rules ORDER BY created_at DESC")
      .all() as unknown as AlertRuleRow[];
    return NextResponse.json({ rules: rows.map(mapRow) });
  } catch {
    return NextResponse.json({ rules: [] });
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const name = body.name as string | undefined;
  const entityType = body.entityType as string | undefined;
  const condition = body.condition as string | undefined;
  const threshold = body.threshold as number | undefined;
  const action = (body.action as string) ?? "toast";
  const cooldownMs = (body.cooldownMs as number) ?? 300000;
  const enabled = body.enabled !== false;

  if (!name || !entityType || !condition || threshold == null) {
    return NextResponse.json(
      { error: "Missing required fields: name, entityType, condition, threshold" },
      { status: 400 },
    );
  }

  const id = `ar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    runtime.db
      .prepare(
        `INSERT INTO alert_rules (id, name, entity_type, condition, threshold, action, cooldown_ms, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, name, entityType, condition, threshold, action, cooldownMs, enabled ? 1 : 0);

    const row = runtime.db
      .prepare("SELECT * FROM alert_rules WHERE id = ?")
      .get(id) as unknown as AlertRuleRow;

    return NextResponse.json({ rule: mapRow(row) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create rule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
