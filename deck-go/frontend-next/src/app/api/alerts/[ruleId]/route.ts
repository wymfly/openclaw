/**
 * PATCH /api/alerts/[ruleId] — Update an alert rule.
 * DELETE /api/alerts/[ruleId] — Delete an alert rule.
 */
import { getAlertRuleStore } from "@server/budget-alert-stores";
import { NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ ruleId: string }> };

async function localAlertsPatchHandler(request: NextRequest, ctx: unknown) {
  const { ruleId } = await (ctx as RouteContext).params;
  const store = getAlertRuleStore();

  const existing = store.find((r) => r.id === ruleId);
  if (!existing) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const allowed = new Set([
    "name",
    "entityType",
    "condition",
    "threshold",
    "action",
    "cooldownMs",
    "enabled",
  ]);

  const hasUpdate = Object.keys(body).some((k) => allowed.has(k));
  if (!hasUpdate) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  store.updateItem(
    (r) => r.id === ruleId,
    (r) => ({
      ...r,
      ...(body.name !== undefined && { name: body.name as string }),
      ...(body.entityType !== undefined && { entityType: body.entityType as string }),
      ...(body.condition !== undefined && { condition: body.condition as string }),
      ...(body.threshold !== undefined && { threshold: body.threshold as number }),
      ...(body.action !== undefined && { action: body.action as string }),
      ...(body.cooldownMs !== undefined && { cooldownMs: body.cooldownMs as number }),
      ...(body.enabled !== undefined && { enabled: body.enabled as boolean }),
      updatedAt: new Date().toISOString(),
    }),
  );

  const updated = store.find((r) => r.id === ruleId);
  return NextResponse.json({ rule: updated });
}

async function localAlertsDeleteHandler(_request: NextRequest, ctx: unknown) {
  const { ruleId } = await (ctx as RouteContext).params;
  const removed = getAlertRuleStore().removeWhere((r) => r.id === ruleId);
  if (removed === 0) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

const guardedLocalAlertsPatchHandler = withAuth(localAlertsPatchHandler);
const guardedLocalAlertsDeleteHandler = withAuth(localAlertsDeleteHandler);

export async function PATCH(request: NextRequest, ctx: unknown) {
  const { ruleId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(request, `/api/v1/alerts/${encodeURIComponent(ruleId)}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalAlertsPatchHandler(request, ctx);
}

export async function DELETE(request: NextRequest, ctx: unknown) {
  const { ruleId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(request, `/api/v1/alerts/${encodeURIComponent(ruleId)}`);
  if (proxied) {
    return proxied;
  }
  return guardedLocalAlertsDeleteHandler(request, ctx);
}
