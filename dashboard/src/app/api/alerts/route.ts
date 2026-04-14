/**
 * GET /api/alerts — List all alert rules.
 * POST /api/alerts — Create a new alert rule.
 */
import { getAlertRuleStore, type AlertRule } from "@server/budget-alert-stores";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  const rules = [...getAlertRuleStore().get()].toSorted(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return NextResponse.json({ rules });
});

export const POST = withAuth(async (request: NextRequest) => {
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

  const now = new Date().toISOString();
  const rule: AlertRule = {
    id: `ar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    entityType,
    condition,
    threshold,
    action,
    cooldownMs,
    lastFiredAt: null,
    enabled,
    createdAt: now,
    updatedAt: now,
  };

  getAlertRuleStore().append(rule);
  return NextResponse.json({ rule }, { status: 201 });
});
