import { NextRequest, NextResponse } from "next/server";
/**
 * PATCH /api/usage/budget/:ruleId — Update a budget rule.
 * DELETE /api/usage/budget/:ruleId — Delete a budget rule.
 *
 * JSON file storage via JsonStore.
 */
import { withAuth } from "@/lib/with-auth";
import { getBudgetRuleStore } from "@server/budget-alert-stores";

const VALID_DIMENSIONS = new Set(["tokensIn", "tokensOut", "totalTokens", "cost"]);
const VALID_PERIODS = new Set(["daily", "weekly", "monthly"]);

type RouteContext = { params: Promise<{ ruleId: string }> };

export const PATCH = withAuth(async (req: NextRequest, ctx: unknown) => {
  const { ruleId } = await (ctx as RouteContext).params;
  const store = getBudgetRuleStore();

  const existing = store.find((r) => r.id === ruleId);
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

  if (body.dimension !== undefined && !VALID_DIMENSIONS.has(body.dimension)) {
    return NextResponse.json({ error: "Invalid dimension" }, { status: 400 });
  }
  if (body.period !== undefined && !VALID_PERIODS.has(body.period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const hasUpdate = Object.keys(body).length > 0;
  if (!hasUpdate) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  store.updateItem(
    (r) => r.id === ruleId,
    (r) => ({
      ...r,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.scope !== undefined && { scope: body.scope }),
      ...(body.agentId !== undefined && { agentId: body.agentId }),
      ...(body.taskId !== undefined && { taskId: body.taskId }),
      ...(body.dimension !== undefined && { dimension: body.dimension }),
      ...(body.warnThreshold !== undefined && { warnThreshold: body.warnThreshold }),
      ...(body.overThreshold !== undefined && { overThreshold: body.overThreshold }),
      ...(body.period !== undefined && { period: body.period }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      updatedAt: new Date().toISOString(),
    }),
  );

  const updated = store.find((r) => r.id === ruleId);
  return NextResponse.json(updated);
});

export const DELETE = withAuth(async (_req: NextRequest, ctx: unknown) => {
  const { ruleId } = await (ctx as RouteContext).params;
  const removed = getBudgetRuleStore().removeWhere((r) => r.id === ruleId);
  if (removed === 0) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
});
