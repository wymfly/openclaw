/**
 * GET /api/alerts — List all alert rules.
 * POST /api/alerts — Create a new alert rule.
 */
import { getAlertRuleStore, type AlertRule } from "@server/budget-alert-stores";
import { NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

async function localAlertsGetHandler(_request: NextRequest) {
  const rules = [...getAlertRuleStore().get()].toSorted(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return NextResponse.json({ rules });
}

async function localAlertsPostHandler(request: NextRequest) {
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
}

const guardedLocalAlertsGetHandler = withAuth(localAlertsGetHandler);
const guardedLocalAlertsPostHandler = withAuth(localAlertsPostHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(request, "/api/v1/alerts");
  if (proxied) {
    return proxied;
  }
  return guardedLocalAlertsGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(request, "/api/v1/alerts");
  if (proxied) {
    return proxied;
  }
  return guardedLocalAlertsPostHandler(request);
}
