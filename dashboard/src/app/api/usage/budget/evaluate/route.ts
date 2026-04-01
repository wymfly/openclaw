import { getRuntime } from "@server/runtime";
import { NextResponse } from "next/server";
import { evaluateBudgetRule, type BudgetDimension, type BudgetRule } from "@/lib/budget-governance";
/**
 * GET /api/usage/budget/evaluate — Evaluate all enabled budget rules.
 *
 * Fetches current usage from Gateway (usage.cost), evaluates each enabled
 * rule, and broadcasts budget.warn / budget.over events via EventBus.
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
}

export const GET = withAuth(async () => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const rows = runtime.db
    .prepare("SELECT * FROM budget_rules WHERE enabled = 1")
    .all() as unknown as BudgetRuleRow[];

  if (rows.length === 0) {
    return NextResponse.json({ evaluations: [] });
  }

  // Fetch current usage from Gateway
  let usageData: Record<string, unknown> = {};
  try {
    usageData = await runtime.adapter.request("usage.cost", { days: 30 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 502 });
  }

  const totals = (usageData.totals ?? {}) as Record<string, unknown>;
  const usageValues: Record<string, number> = {
    tokensIn: Number(totals.input ?? 0),
    tokensOut: Number(totals.output ?? 0),
    totalTokens: Number(totals.totalTokens ?? 0),
    cost: Number(totals.totalCost ?? 0),
  };

  const evaluations = rows.map((row) => {
    const rule: BudgetRule = {
      id: row.id,
      name: row.name,
      scope: row.scope,
      agentId: row.agent_id ?? undefined,
      taskId: row.task_id ?? undefined,
      dimension: row.dimension as BudgetDimension,
      warnThreshold: row.warn_threshold ?? undefined,
      overThreshold: row.over_threshold ?? undefined,
      period: row.period,
      enabled: row.enabled,
    };

    const currentValue = usageValues[rule.dimension] ?? 0;
    const result = evaluateBudgetRule(rule, currentValue);

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      dimension: rule.dimension,
      ...result,
    };
  });

  // Broadcast budget alerts via EventBus
  for (const evaluation of evaluations) {
    if (evaluation.status === "warn") {
      runtime.eventBus.broadcast("budget.warn", evaluation);
    } else if (evaluation.status === "over") {
      runtime.eventBus.broadcast("budget.over", evaluation);
    }
  }

  return NextResponse.json({ evaluations });
});
