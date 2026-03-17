import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
/**
 * GET /api/usage/budget — List all budget rules.
 * POST /api/usage/budget — Create a new budget rule.
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

const VALID_DIMENSIONS = new Set(["tokensIn", "tokensOut", "totalTokens", "cost"]);
const VALID_PERIODS = new Set(["daily", "weekly", "monthly"]);

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

export const GET = withAuth(async () => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const rows = runtime.db
    .prepare("SELECT * FROM budget_rules ORDER BY created_at DESC")
    .all() as BudgetRuleRow[];

  return NextResponse.json({ rules: rows.map(rowToRule) });
});

export const POST = withAuth(async (req: NextRequest) => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const body = (await req.json()) as {
    name?: string;
    scope?: string;
    agentId?: string;
    taskId?: string;
    dimension?: string;
    warnThreshold?: number;
    overThreshold?: number;
    period?: string;
    enabled?: boolean;
  };

  if (!body.name || !body.dimension) {
    return NextResponse.json({ error: "name and dimension are required" }, { status: 400 });
  }

  if (!VALID_DIMENSIONS.has(body.dimension)) {
    return NextResponse.json({ error: "Invalid dimension" }, { status: 400 });
  }

  const period = body.period ?? "monthly";
  if (!VALID_PERIODS.has(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const scope = body.scope ?? "global";
  const enabled = body.enabled !== false ? 1 : 0;

  runtime.db
    .prepare(
      `INSERT INTO budget_rules (id, name, scope, agent_id, task_id, dimension, warn_threshold, over_threshold, period, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      body.name,
      scope,
      body.agentId ?? null,
      body.taskId ?? null,
      body.dimension,
      body.warnThreshold ?? null,
      body.overThreshold ?? null,
      period,
      enabled,
    );

  const row = runtime.db
    .prepare("SELECT * FROM budget_rules WHERE id = ?")
    .get(id) as BudgetRuleRow;

  return NextResponse.json(rowToRule(row), { status: 201 });
});
