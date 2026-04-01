import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
/**
 * PATCH /api/usage/budget/:ruleId — Update a budget rule.
 * DELETE /api/usage/budget/:ruleId — Delete a budget rule.
 *
 * Local SQLite only — no Gateway RPC.
 */
import { withAuth } from "@/lib/with-auth";

interface BudgetRuleRow {
  id: string;
  name: string;
  scope: string;
  agent_id: string | null;
  task_id: string | null;
  dimension: string;
  warn_threshold: number | null;
  over_threshold: number | null;
  period: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function rowToRule(row: BudgetRuleRow) {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    agentId: row.agent_id,
    taskId: row.task_id,
    dimension: row.dimension,
    warnThreshold: row.warn_threshold,
    overThreshold: row.over_threshold,
    period: row.period,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const VALID_DIMENSIONS = new Set(["tokensIn", "tokensOut", "totalTokens", "cost"]);
const VALID_PERIODS = new Set(["daily", "weekly", "monthly"]);

type RouteContext = { params: Promise<{ ruleId: string }> };

export const PATCH = withAuth(async (req: NextRequest, ctx: unknown) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { ruleId } = await (ctx as RouteContext).params;

  const existing = runtime.db.prepare("SELECT id FROM budget_rules WHERE id = ?").get(ruleId);
  if (!existing) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    name?: string;
    scope?: string;
    agentId?: string | null;
    taskId?: string | null;
    dimension?: string;
    warnThreshold?: number | null;
    overThreshold?: number | null;
    period?: string;
    enabled?: boolean;
  };

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    sets.push("name = ?");
    values.push(body.name);
  }
  if (body.scope !== undefined) {
    sets.push("scope = ?");
    values.push(body.scope);
  }
  if (body.agentId !== undefined) {
    sets.push("agent_id = ?");
    values.push(body.agentId);
  }
  if (body.taskId !== undefined) {
    sets.push("task_id = ?");
    values.push(body.taskId);
  }
  if (body.dimension !== undefined) {
    if (!VALID_DIMENSIONS.has(body.dimension)) {
      return NextResponse.json({ error: "Invalid dimension" }, { status: 400 });
    }
    sets.push("dimension = ?");
    values.push(body.dimension);
  }
  if (body.warnThreshold !== undefined) {
    sets.push("warn_threshold = ?");
    values.push(body.warnThreshold);
  }
  if (body.overThreshold !== undefined) {
    sets.push("over_threshold = ?");
    values.push(body.overThreshold);
  }
  if (body.period !== undefined) {
    if (!VALID_PERIODS.has(body.period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }
    sets.push("period = ?");
    values.push(body.period);
  }
  if (body.enabled !== undefined) {
    sets.push("enabled = ?");
    values.push(body.enabled ? 1 : 0);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  sets.push("updated_at = datetime('now')");
  values.push(ruleId);

  runtime.db.prepare(`UPDATE budget_rules SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  const row = runtime.db
    .prepare("SELECT * FROM budget_rules WHERE id = ?")
    .get(ruleId) as unknown as BudgetRuleRow;
  return NextResponse.json(rowToRule(row));
});

export const DELETE = withAuth(async (_req: NextRequest, ctx: unknown) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { ruleId } = await (ctx as RouteContext).params;

  const result = runtime.db.prepare("DELETE FROM budget_rules WHERE id = ?").run(ruleId);
  if (result.changes === 0) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
});
