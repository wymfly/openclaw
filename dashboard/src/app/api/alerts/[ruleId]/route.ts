/**
 * PATCH /api/alerts/[ruleId] — Update an alert rule.
 * DELETE /api/alerts/[ruleId] — Delete an alert rule.
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

export const PATCH = withAuth(async (request: NextRequest, ctx: unknown) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const { ruleId } = (ctx as { params: Promise<{ ruleId: string }> }).params
    ? await (ctx as { params: Promise<{ ruleId: string }> }).params
    : { ruleId: "" };

  const body = (await request.json()) as Record<string, unknown>;

  // Build dynamic SET clause from allowed fields
  const allowed: Record<string, string> = {
    name: "name",
    entityType: "entity_type",
    condition: "condition",
    threshold: "threshold",
    action: "action",
    cooldownMs: "cooldown_ms",
    enabled: "enabled",
  };

  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [jsKey, dbCol] of Object.entries(allowed)) {
    if (jsKey in body) {
      sets.push(`${dbCol} = ?`);
      const val = body[jsKey];
      values.push(jsKey === "enabled" ? (val ? 1 : 0) : val);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  sets.push("updated_at = datetime('now')");
  values.push(ruleId);

  try {
    const info = runtime.db
      .prepare(`UPDATE alert_rules SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);

    if (info.changes === 0) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const row = runtime.db
      .prepare("SELECT * FROM alert_rules WHERE id = ?")
      .get(ruleId) as unknown as AlertRuleRow;

    return NextResponse.json({ rule: mapRow(row) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update rule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const DELETE = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const { ruleId } = (ctx as { params: Promise<{ ruleId: string }> }).params
    ? await (ctx as { params: Promise<{ ruleId: string }> }).params
    : { ruleId: "" };

  try {
    const info = runtime.db.prepare("DELETE FROM alert_rules WHERE id = ?").run(ruleId);

    if (info.changes === 0) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete rule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
