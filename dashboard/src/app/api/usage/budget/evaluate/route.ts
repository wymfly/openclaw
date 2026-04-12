import { getRuntime } from "@server/runtime";
import { NextResponse } from "next/server";
import { evaluateBudgetRule, type BudgetDimension, type BudgetRule as GovBudgetRule } from "@/lib/budget-governance";
/**
 * GET /api/usage/budget/evaluate — Evaluate all enabled budget rules.
 *
 * Fetches current usage from Gateway (usage.cost), evaluates each enabled
 * rule, and broadcasts budget.warn / budget.over events via EventBus.
 */
import { withAuth } from "@/lib/with-auth";
import { getBudgetRuleStore } from "@server/budget-alert-stores";

export const GET = withAuth(async () => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const rules = getBudgetRuleStore().get().filter((r) => r.enabled);

  if (rules.length === 0) {
    return NextResponse.json({ evaluations: [] });
  }

  // Fetch current usage from Gateway
  let usageData: Record<string, unknown> = {};
  try {
    usageData = (await runtime.adapter.request("usage.cost", { days: 30 })) as Record<
      string,
      unknown
    >;
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

  const evaluations = rules.map((row) => {
    const rule: GovBudgetRule = {
      id: row.id,
      name: row.name,
      scope: row.scope,
      agentId: row.agentId ?? undefined,
      taskId: row.taskId ?? undefined,
      dimension: row.dimension as BudgetDimension,
      warnThreshold: row.warnThreshold ?? undefined,
      overThreshold: row.overThreshold ?? undefined,
      period: row.period,
      enabled: row.enabled ? 1 : 0,
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
