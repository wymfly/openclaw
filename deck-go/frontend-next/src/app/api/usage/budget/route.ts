import { getBudgetRuleStore, type BudgetRule } from "@server/budget-alert-stores";
import { NextRequest, NextResponse } from "next/server";
import { maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";
/**
 * GET /api/usage/budget — List all budget rules.
 * POST /api/usage/budget — Create a new budget rule.
 *
 * JSON file storage via JsonStore.
 */
import { withAuth } from "@/lib/with-auth";

const VALID_DIMENSIONS = new Set(["tokensIn", "tokensOut", "totalTokens", "cost"]);
const VALID_PERIODS = new Set(["daily", "weekly", "monthly"]);

async function localBudgetGetHandler(_request: NextRequest) {
  const rules = [...getBudgetRuleStore().get()].toSorted(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return NextResponse.json({ rules });
}

async function localBudgetPostHandler(req: NextRequest) {
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

  const now = new Date().toISOString();
  const rule: BudgetRule = {
    id: crypto.randomUUID(),
    name: body.name,
    scope: body.scope ?? "global",
    agentId: body.agentId ?? null,
    taskId: body.taskId ?? null,
    dimension: body.dimension,
    warnThreshold: body.warnThreshold ?? null,
    overThreshold: body.overThreshold ?? null,
    period,
    enabled: body.enabled !== false,
    createdAt: now,
    updatedAt: now,
  };

  getBudgetRuleStore().append(rule);
  return NextResponse.json(rule, { status: 201 });
}

const guardedLocalBudgetGetHandler = withAuth(localBudgetGetHandler);
const guardedLocalBudgetPostHandler = withAuth(localBudgetPostHandler);

export async function GET(request: NextRequest) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/usage/budget");
  if (proxied) {
    return proxied;
  }
  return guardedLocalBudgetGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/usage/budget");
  if (proxied) {
    return proxied;
  }
  return guardedLocalBudgetPostHandler(request);
}
